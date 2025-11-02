import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import './TrainRow.js';
import type { StationTimetableEntry } from '../types';
import type { SimpleCache } from '../cache';

/**
 * DeparturesList component - displays a list of train departures
 */
@customElement('departures-list')
export class DeparturesList extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .empty-message {
      text-align: center;
      font-size: 1.5rem;
      padding-top: 2rem;
    }

    .loading-message {
      text-align: center;
      font-size: 1.5rem;
      padding-top: 2rem;
    }

    .space-y-1 > * + * {
      margin-top: 0.25rem;
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
      <div class="space-y-1">
        ${repeat(
          this.departures,
          (train) => (train as any)['odpt:departureTime'] || Math.random(),
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
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'departures-list': DeparturesList;
  }
}
