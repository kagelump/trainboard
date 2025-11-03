import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import './TrainRow.js';
import { TrainDepartureView } from './TrainDepartureView.js';
import type { StationTimetableEntry } from '../types';
import type { SimpleCache } from '../cache';
import { TickManager, globalTickManager } from '../tickManager';
import { provide } from '@lit/context';
import { tickManagerContext } from './TimerContext.js';

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

  @provide({ context: tickManagerContext })
  tickManager: TickManager = globalTickManager;

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

  private handleTrainDeparted = (e: CustomEvent): void => {
    // Remove the departed train from departures, this should trigger a rerender.
    try {
      const detail = e?.detail as { departureTime?: string } | undefined;
      const depTime = detail?.departureTime;
      if (depTime) {
        // Find the first matching departure by departureTime and remove it.
        const idx = this.departures.findIndex((d) => d.departureTime === depTime);
        if (idx !== -1) {
          this.departures = this.departures.filter((_, i) => i !== idx);
        }
      }
    } catch (err) {
      console.warn('Failed to remove departed train by event detail:', err);
    }
  };

  firstUpdated() {
    this.dispatchEvent(
      new CustomEvent('departures-list-rendered', { bubbles: true, composed: true }),
    );
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
              @train-departed=${this.handleTrainDeparted}
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
