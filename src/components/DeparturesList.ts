import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import './TrainRow.js';
import type { StationTimetableEntry } from '../types';
import type { SimpleCache } from '../cache';
import { tickManager, type TickEvent } from '../tickManager';

import { DISPLAYED_TRAINS_LIMIT } from '../constants';

export class TrainDepartureView {
  departureTime: string;
  trainTypeUri: string;
  // We only care about one destination.  Maybe there are cases with multiple? idk.
  destination: string;

  /**
   * Construct a TrainDepartureView from a StationTimetableEntry.
   * @param entry Raw StationTimetableEntry from ODPT
   * @param stationNameCache Optional cache mapping station URIs to display names
   */
  constructor(entry: StationTimetableEntry, stationNameCache?: SimpleCache<string> | null) {
    this.departureTime = (entry['odpt:departureTime'] || '') as string;
    this.trainTypeUri = (entry['odpt:trainType'] || '') as string;

    // Resolve a human-friendly destination title. The API may return either
    // a string URI or an object with dc:title or owl:sameAs. Prefer the cached
    // station name when available.
    let destinationTitle = 'N/A';
    const dests = entry['odpt:destinationStation'];
    if (Array.isArray(dests) && dests.length > 0) {
      const first = dests[0];
      if (typeof first === 'string') {
        destinationTitle = (stationNameCache && stationNameCache.get(first)) || first;
      } else if (first && typeof first === 'object') {
        destinationTitle = (first as any)['dc:title'] || (first as any)['title'] || 'N/A';
        if ((destinationTitle === 'N/A' || !destinationTitle) && (first as any)['owl:sameAs']) {
          const uri = (first as any)['owl:sameAs'];
          if (typeof uri === 'string')
            destinationTitle = (stationNameCache && stationNameCache.get(uri)) || uri;
        }
      }
    } else if (typeof dests === 'string') {
      destinationTitle = (stationNameCache && stationNameCache.get(dests)) || dests;
    }

    this.destination = destinationTitle;
  }

  /**
   * Helper to create a view from an entry, used by callers that prefer a factory.
   */
  static from(entry: StationTimetableEntry, stationNameCache?: SimpleCache<string> | null) {
    return new TrainDepartureView(entry, stationNameCache);
  }
}

/**
 * DeparturesList component - displays a list of train departures
 */
@customElement('departures-list')
export class DeparturesList extends LitElement {
  static styles = css`
    :host {
      display: grid;
      /* Columns: minutes | time | train-type | destination */
      grid-template-columns: 1fr 1fr 1fr 1.5fr;
      gap: 0.5rem;
      row-gap: 0.5rem;
      align-items: center;
    }

    .empty-message {
      text-align: center;
      font-size: 1.5rem;
      padding-top: 2rem;
      grid-column: 1 / -1;
    }

    .loading-message {
      text-align: center;
      font-size: 1.5rem;
      padding-top: 2rem;
      grid-column: 1 / -1;
    }

    /* Responsive: mobile-friendly layout tweaks */
    @media (max-width: 640px) {
      :host {
        grid-template-columns: 1fr 1fr 1fr 2fr;
        gap: 0.25rem;
        row-gap: 0.25rem;
      }
    }
  `;

  @property({ type: Array })
  departures: TrainDepartureView[] = [];

  @property({ type: Object })
  stationNameCache: SimpleCache<string> | null = null;

  @property({ type: Object })
  trainTypeMap: Record<string, { name: string; class: string }> = {};

  @property({ type: Boolean })
  loading = false;

  @property({ type: Number })
  displayLimit = DISPLAYED_TRAINS_LIMIT;

  private tickCallback: ((event: TickEvent) => void) | null = null;
  // NOTE: TrainRow now owns parsing and minutes calculation.

  private updateMinutesOnce = (nowSeconds: number): void => {
    const trainRows = Array.from(this.shadowRoot?.querySelectorAll('train-row') || []);
    if (trainRows.length === 0) return;

    const departedIndices: number[] = [];
    trainRows.forEach((trainRow, index) => {
      // Delegate minutes calculation to the TrainRow component. The
      // TrainRow.updateMinutes returns true when the train has departed.
      try {
        const departed = (trainRow as any).updateMinutes(nowSeconds);
        if (departed) departedIndices.push(index);
      } catch (e) {
        // On any error, skip updating this row but continue processing others
        console.warn('Failed to update minutes on train-row', e);
      }
    });

    if (departedIndices.length > 0) {
      // Map departed indices (which correspond to positions within the displayed
      // slice) to indices within the full `departures` array. Since we render
      // only the first `displayLimit` items, the displayed index matches the
      // same index in the full array.
      const fullDepartedIndices = departedIndices;

      // Remove departed entries from the full departures list. Remaining
      // entries (including ones beyond displayLimit) will automatically shift
      // into the displayed window on the next render.
      const updatedDepartures = this.departures.filter((_, i) => !fullDepartedIndices.includes(i));
      this.departures = updatedDepartures;
      this.dispatchEvent(
        new CustomEvent('departures-list-departed', {
          detail: { departedCount: departedIndices.length },
          bubbles: true,
          composed: true,
        }),
      );
    }
  };

  private startTickListener() {
    if (this.tickCallback) return;

    this.tickCallback = (event: TickEvent) => {
      this.updateMinutesOnce(event.currentTimeSeconds);
    };
    tickManager.onMinorTick(this.tickCallback);
  }

  private stopTickListener() {
    if (!this.tickCallback) return;
    tickManager.offMinorTick(this.tickCallback);
    this.tickCallback = null;
  }

  // Mark when the component has completed its first render. Tests and
  // the minutes-updater can listen for the 'departures-list-rendered'
  // event to know it's safe to query the element's shadow DOM.
  private __rendered = false;

  connectedCallback() {
    super.connectedCallback();
    // No longer need visibility change handler - tick manager handles pause/resume
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up
    this.stopTickListener();
  }

  firstUpdated() {
    this.__rendered = true;
    this.dispatchEvent(
      new CustomEvent('departures-list-rendered', { bubbles: true, composed: true }),
    );
    this.startTickListener();
  }

  updated(changedProps: Map<string, any>) {
    // When departures change, ensure minutes are calculated for the newly rendered rows.
    if (changedProps.has('departures')) {
      // Only update if there are departures to show.
      if (this.departures && this.departures.length > 0) {
        // Wait for the update cycle to complete and the shadow DOM to be ready.
        // Calculate current time immediately for responsive UX (don't wait for next tick)
        const now = new Date();
        const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        this.updateComplete.then(() => this.updateMinutesOnce(nowSeconds));
      }
    }
  }

  render() {
    if (this.loading) {
      return html`<p class="loading-message">時刻表を取得中...</p>`;
    }

    if (this.departures.length === 0) {
      return html`<p class="empty-message">本日の発車予定はありません。</p>`;
    }

    // Convert the first `displayLimit` raw entries into lightweight views
    // which normalize the fields we care about (departureTime, trainTypeUri,
    // and destination string). This keeps rendering code simple and makes
    // the template work with a consistent shape.
    const displayedEntries = this.departures.slice(0, this.displayLimit);

    return html`
      ${repeat(
        displayedEntries,
        (view, index) => view.departureTime || `train-${index}`,
        (view) => {
          const departureTime = view.departureTime || '';
          const trainType = this.trainTypeMap[view.trainTypeUri] || {
            name: '不明',
            class: 'type-LOC',
          };

          return html`
            <train-row
              departureTime="${departureTime}"
              trainTypeName="${trainType.name}"
              trainTypeClass="${trainType.class}"
              destination="${view.destination}"
            ></train-row>
          `;
        },
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'departures-list': DeparturesList;
  }
}
