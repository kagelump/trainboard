import { html, css, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
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

    /* Minutes column - small numeric column */
    .minutes-col {
      font-size: 1.5rem;
      font-weight: 700;
      text-align: center;
      color: #fff;
    }

    /* Time column - large and prominent */
    .time-col {
      font-size: 3rem;
      font-weight: 700;
      line-height: 1;
      text-align: center;
      align-self: center;
    }

    .train-type-badge-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    /* Train Type badge */
    .train-type-badge {
      font-size: 1.5rem;
      font-weight: 800;
      padding: 0.25rem 0.5rem;
      border-radius: 0.5rem;
      text-align: center;
      line-height: 1.2;
      align-self: center;
      max-width: fit-content;
      white-space: nowrap;
      /* Default colors for fallback */
      background-color: #333;
      color: #fff;
      border: 2px solid #333;
    }

    /* Default style for unknown/local train types */
    .type-LOC {
      background-color: #333;
      color: #fff;
      border: 2px solid #333;
    }

    /* Destination Text */
    .destination-text {
      font-size: 1.75rem;
      font-weight: 600;
      line-height: 1.2;
      align-self: center;
      text-align: center;
      word-break: break-word;
    }

    /* Responsive: mobile-friendly layout tweaks */
    @media (max-width: 640px) {
      .minutes-col {
        font-size: 1rem;
      }

      .time-col {
        font-size: 1rem;
        text-align: left;
        line-height: 1;
      }

      .train-type-badge {
        font-size: 1rem;
        padding: 0.2rem 0.45rem;
        align-items: center;
        justify-content: flex-start;
      }

      .destination-text {
        font-size: 1rem;
        text-align: center;
        word-break: break-word;
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

  // Convert HH:MM to seconds since midnight
  private parseTimeToSeconds(timeStr: string): number {
    const [hStr, mStr] = (timeStr || '').split(':');
    const h = Number(hStr || 0);
    const m = Number(mStr || 0);
    return h * 3600 + m * 60;
  }

  /**
   * Update the minutes display for this train row.
   * Returns true if the train has departed (i.e. should be removed from the list),
   * otherwise false.
   */
  public updateMinutes(nowSeconds?: number): boolean {
    const now =
      typeof nowSeconds === 'number'
        ? nowSeconds
        : (() => {
            const d = new Date();
            return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
          })();

    const dep = (this.departureTime as string) || this.getAttribute('departuretime') || '';
    const depSecs = this.parseTimeToSeconds(dep);
    const diff = depSecs - now;

    // If departure time is already in the past, consider it departed.
    if (diff < 0) {
      return true; // departed
    }

    // If departure is within the next 60 seconds, show '到着'
    if (diff <= 60) {
      this.minutesText = '到着';
    } else {
      const mins = Math.ceil(diff / 60);
      this.minutesText = `${mins}分`;
    }

    return false;
  }

  render() {
    return html`
      <div class="minutes-col" data-departure="${this.departureTime}">${this.minutesText}</div>
      <div class="time-col">${this.departureTime || '--'}</div>
      <div class="train-type-badge-wrapper">
        <span part="badge" class="train-type-badge ${this.trainTypeClass}"
          >${this.trainTypeName}</span
        >
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
