import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { getTrainTypeStyleSheet } from '../trainTypeStyles.js';

/**
 * TrainRow component - displays a single train departure row
 */
@customElement('train-row')
export class TrainRow extends LitElement {
  static styles = css`
    /* Use display: contents to make this component transparent to layout,
       allowing its children to participate in the parent grid */
    :host {
      display: contents;
    }

    .minutes-col,
    .time-col {
      text-align: center;
    }

    .train-type-badge-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .train-type-badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 0.5rem;
      text-align: center;
      line-height: 1.2;
      white-space: nowrap;
      font-size: 1.5rem;
      font-weight: 800;
      max-width: fit-content;
      /* Default colors for fallback */
      background-color: #333;
      color: #fff;
      border: 2px solid #333;
    }

    .destination-text {
      text-align: center;
      word-break: break-word;
    }

    @media (max-width: 640px) {
      .train-type-badge {
        font-size: 1rem;
        padding: 0.2rem 0.45rem;
      }
    }
  `;

  // Adopt the train type stylesheet when component is connected
  connectedCallback() {
    super.connectedCallback();
    const trainTypeSheet = getTrainTypeStyleSheet();
    if (trainTypeSheet && this.shadowRoot) {
      try {
        // Adopt the dynamically generated train type styles
        this.shadowRoot.adoptedStyleSheets = [
          ...this.shadowRoot.adoptedStyleSheets,
          trainTypeSheet,
        ];
      } catch (e) {
        console.warn('Failed to adopt train type stylesheet:', e);
      }
    }
  }

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
      <div class="minutes-col" data-departure="${this.departureTime}">${this.minutesText}</div>
      <div class="time-col">${this.departureTime || '--'}</div>
      <div class="train-type-badge-wrapper">
        <span part="badge" class="train-type-badge ${this.trainTypeClass}">${this.trainTypeName}</span>
      </div>
      <div class="destination-text">${this.destination}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'train-row': TrainRow;
  }
}
