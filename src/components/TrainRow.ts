import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * TrainRow component - displays a single train departure row
 */
@customElement('train-row')
export class TrainRow extends LitElement {
  static styles = css`
    .train-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 2fr;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem;
      gap: 0.5rem;
    }

    .minutes-col,
    .time-col {
      text-align: center;
      font-size: 1.25rem;
      font-weight: bold;
    }

    .train-type-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 0.375rem;
      font-weight: bold;
      font-size: 0.875rem;
    }

    .destination-text {
      font-size: 1.25rem;
      font-weight: 600;
    }

    /* Train type colors - these should match the existing CSS */
    .type-EXP {
      background-color: #ef4444;
      color: white;
    }

    .type-LTD {
      background-color: #dc2626;
      color: white;
    }

    .type-LOC {
      background-color: #94a3b8;
      color: black;
    }

    .type-SEMI {
      background-color: #22c55e;
      color: white;
    }

    .type-RAP {
      background-color: #f97316;
      color: white;
    }

    @media (max-width: 768px) {
      .train-row {
        grid-template-columns: 0.8fr 0.8fr 1fr 1.5fr;
        gap: 0.25rem;
      }

      .minutes-col,
      .time-col,
      .destination-text {
        font-size: 1rem;
      }

      .train-type-badge {
        font-size: 0.75rem;
        padding: 0.2rem 0.5rem;
      }
    }
  `;

  @property({ type: String })
  departureTime = '';

  @property({ type: String })
  trainTypeName = '';

  @property({ type: String })
  trainTypeClass = '';

  @property({ type: String })
  destination = '';

  @property({ type: String })
  minutesText = '--';

  render() {
    return html`
      <div class="train-row" data-departure="${this.departureTime}">
        <div class="minutes-col" data-departure="${this.departureTime}">
          ${this.minutesText}
        </div>
        <div class="time-col">${this.departureTime || '--'}</div>
        <div style="display: flex; justify-content: center; align-items: center;">
          <span class="train-type-badge ${this.trainTypeClass}">${this.trainTypeName}</span>
        </div>
        <div class="destination-text">${this.destination}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'train-row': TrainRow;
  }
}
