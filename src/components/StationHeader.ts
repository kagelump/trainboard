import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * StationHeader component - displays the current station name, railway, and operator
 */
@customElement('station-header')
export class StationHeader extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      display: flex;
      flex-direction: row;
      align-items: center;
      width: 100%;
      justify-content: space-around;
    }

    .station-name {
      font-size: 1.875rem; /* text-3xl */
      letter-spacing: -0.025em; /* tracking-tight */
      line-height: 1.2;
    }

    .railway-info {
      font-size: 1rem;
      opacity: 0.8;
      line-height: 1.2;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    @media (min-width: 640px) {
      .station-name {
        font-size: 3rem; /* sm:text-5xl */
      }

      .railway-info {
        font-size: 1.5rem;
      }
    }
  `;

  @property({ type: String })
  stationName = '読込中...';

  @property({ type: String })
  railwayName = '';

  @property({ type: String })
  operatorName = '';

  render() {
    return html`
      <div class="railway-info">
        <div class="operator-name">${this.operatorName}</div>
        <div class="railway-name">${this.railwayName}</div>
      </div>
      <div class="station-name">${this.stationName}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'station-header': StationHeader;
  }
}
