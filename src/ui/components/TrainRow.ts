import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { getTrainTypeStyleSheet } from '../trainTypeStyles.js';
import { tickManagerContext } from './TimerContext.js';
import { TickEvent, TickManager } from '../../lib/tickManager.js';

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

    /* Non-local train destination styling */
    .destination-text.non-local {
      color: yellow;
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

  @consume({ context: tickManagerContext })
  @property({ attribute: false })
  private tickManager!: TickManager;

  @property({ type: Number })
  // Initialize to current seconds-since-midnight by default so rows can
  // compute minutes immediately without waiting for an external update.
  nowSeconds: number = (() => {
    const d = new Date();
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  })();

  @property({ type: String })
  departureTime = '';

  @property({ type: String })
  trainTypeName = '';

  @property({ type: String })
  trainTypeClass = '';

  @property({ type: String })
  trainTypeUri = '';

  @property({ type: String })
  destination = '';

  // Convert HH:MM to seconds since midnight
  private departureTimeSec(): number {
    const [hStr, mStr] = (this.departureTime || '').split(':');
    const h = Number(hStr || 0);
    const m = Number(mStr || 0);
    return h * 3600 + m * 60;
  }

  /**
   * Compute the minutes display string for this train row.
   */
  public minutes(): string {
    const diff = this.departureTimeSec() - this.nowSeconds;

    if (diff < 0) {
      return '発車済';
    } else if (diff <= 60) {
      return '到着';
    } else {
      const mins = Math.ceil(diff / 60);
      return `${mins}分`;
    }
  }

  /**
   * Returns true if the train should be considered departed and removed from the list.
   */
  public trainDeparted(): boolean {
    // If departure time is already more than 60s in the past, consider it departed.
    return this.departureTimeSec() - this.nowSeconds < -60;
  }

  /**
   * Returns true if the train type is a local train.
   */
  private isLocalTrain(): boolean {
    // Check if the trainTypeUri contains ".Local"
    return this.trainTypeUri.includes('.Local');
  }

  private onTick(e: TickEvent): void {
    console.log('TrainRow received tick event:', e);
    this.nowSeconds = e.currentTimeSeconds;
    if (this.trainDeparted()) {
      this.dispatchEvent(
        new CustomEvent('train-departed', {
          bubbles: true,
          composed: true,
          detail: { departureTime: this.departureTime }, // This is unique for a departure list.
        }),
      );
      e.unsubscribe();
    }
  }

  firstUpdated() {
    this.tickManager.onMinorTick((e) => {
      this.onTick(e);
    });
  }

  render() {
    const destinationClass = this.isLocalTrain()
      ? 'destination-text'
      : 'destination-text non-local';

    return html`
      <div class="minutes-col" data-departure="${this.departureTime}">${this.minutes()}</div>
      <div class="time-col">${this.departureTime || '--'}</div>
      <div class="train-type-badge-wrapper">
        <span part="badge" class="train-type-badge ${this.trainTypeClass}"
          >${this.trainTypeName}</span
        >
      </div>
      <div class="${destinationClass}">${this.destination}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'train-row': TrainRow;
  }
}
