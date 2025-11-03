import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import './TrainRow.js';
import type { StationTimetableEntry } from '../types';
import type { SimpleCache } from '../cache';
import { visibilityManager } from '../visibilityManager';

import { DISPLAYED_TRAINS_LIMIT } from '../constants';

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
  departures: StationTimetableEntry[] = [];

  @property({ type: Object })
  stationNameCache: SimpleCache<string> | null = null;

  @property({ type: Object })
  trainTypeMap: Record<string, { name: string; class: string }> = {};

  @property({ type: Boolean })
  loading = false;

  @property({ type: Boolean })
  autoUpdateMinutes = false;

  @property({ type: Array })
  trainCache: StationTimetableEntry[] = [];

  @property({ type: Number })
  displayLimit = DISPLAYED_TRAINS_LIMIT;

  private minutesUpdaterId: number | undefined;
  // NOTE: TrainRow now owns parsing and minutes calculation. Remove this
  // helper when no other modules reference it.

  private updateMinutesOnce = (): void => {
    const now = new Date();
    const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

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
      // Remove departed from displayed departures
      const updatedDepartures = this.departures.filter((_, i) => !departedIndices.includes(i));

      // Pull replacements from trainCache
      const nextTrains = this.trainCache.slice(0, departedIndices.length);
      updatedDepartures.push(...nextTrains);
      // Drop used trains from cache
      this.trainCache = this.trainCache.slice(nextTrains.length);

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

  private startMinutesUpdater() {
    if (this.minutesUpdaterId) return;
    // Only start if page is visible
    if (!visibilityManager.getIsVisible()) return;
    this.minutesUpdaterId = window.setInterval(this.updateMinutesOnce, 15_000) as unknown as number;
  }

  private stopMinutesUpdater() {
    if (!this.minutesUpdaterId) return;
    clearInterval(this.minutesUpdaterId);
    this.minutesUpdaterId = undefined;
  }

  private onVisibilityChange = (isVisible: boolean) => {
    if (isVisible && this.autoUpdateMinutes) {
      // Resume the updater when page becomes visible
      this.startMinutesUpdater();
      // Update immediately when resuming
      this.updateMinutesOnce();
    } else {
      // Pause the updater when page is hidden
      this.stopMinutesUpdater();
    }
  };

  // Mark when the component has completed its first render. Tests and
  // the minutes-updater can listen for the 'departures-list-rendered'
  // event to know it's safe to query the element's shadow DOM.
  private __rendered = false;

  connectedCallback() {
    super.connectedCallback();
    // Register visibility change handler
    visibilityManager.onVisibilityChange(this.onVisibilityChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up
    this.stopMinutesUpdater();
    visibilityManager.offVisibilityChange(this.onVisibilityChange);
  }

  firstUpdated() {
    this.__rendered = true;
    this.dispatchEvent(
      new CustomEvent('departures-list-rendered', { bubbles: true, composed: true }),
    );
    if (this.autoUpdateMinutes) this.startMinutesUpdater();
  }

  updated(changedProps: Map<string, any>) {
    if (changedProps.has('autoUpdateMinutes')) {
      if (this.autoUpdateMinutes) this.startMinutesUpdater();
      else this.stopMinutesUpdater();
    }
    // When departures change, ensure minutes are calculated for the newly rendered rows.
    if (changedProps.has('departures')) {
      // Only update if there are departures to show.
      if (this.departures && this.departures.length > 0) {
        // Wait for the update cycle to complete and the shadow DOM to be ready.
        this.updateComplete.then(() => this.updateMinutesOnce());
      }
    }
  }

  /**
   * Extract destination station title from train object
   */
  private getDestinationTitle(train: StationTimetableEntry): string {
    if (!this.stationNameCache) return 'N/A';

    let destinationTitle = 'N/A';
    const dests = (train as any)['odpt:destinationStation'];
    if (Array.isArray(dests) && dests.length > 0) {
      const first = dests[0];
      if (typeof first === 'string') {
        destinationTitle = this.stationNameCache.get(first) || first;
      } else if (first && typeof first === 'object') {
        destinationTitle = (first as any)['dc:title'] || (first as any)['title'] || 'N/A';
        if ((!destinationTitle || destinationTitle === 'N/A') && (first as any)['owl:sameAs']) {
          const uri = (first as any)['owl:sameAs'];
          if (typeof uri === 'string') destinationTitle = this.stationNameCache.get(uri) || uri;
        }
      }
    } else if (typeof dests === 'string') {
      destinationTitle = this.stationNameCache.get(dests) || dests;
    }
    return destinationTitle;
  }

  render() {
    if (this.loading) {
      return html`<p class="loading-message">時刻表を取得中...</p>`;
    }

    if (this.departures.length === 0) {
      return html`<p class="empty-message">本日の発車予定はありません。</p>`;
    }

    return html`
      ${repeat(
        this.departures,
        (train, index) => (train as any)['odpt:departureTime'] || `train-${index}`,
        (train) => {
          const departureTime = (train as any)['odpt:departureTime'] || '';
          const trainTypeUri = (train as any)['odpt:trainType'] || '';
          const destinationTitle = this.getDestinationTitle(train);
          const trainType = this.trainTypeMap[trainTypeUri] || {
            name: '不明',
            class: 'type-LOC',
          };

          return html`
            <train-row
              departureTime="${departureTime}"
              trainTypeName="${trainType.name}"
              trainTypeClass="${trainType.class}"
              destination="${destinationTitle}"
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
