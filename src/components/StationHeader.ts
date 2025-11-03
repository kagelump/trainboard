import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * StationHeader component - displays the current station name
 */
@customElement('station-header')
export class StationHeader extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .station-name {
      font-size: 1.875rem; /* text-3xl */
      letter-spacing: -0.025em; /* tracking-tight */
    }

    @media (min-width: 640px) {
      .station-name {
        font-size: 3rem; /* sm:text-5xl */
      }
    }
  `;

  @property({ type: String })
  stationName = '読込中...';

  render() {
    return html`<h1 class="station-name">${this.stationName}</h1>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'station-header': StationHeader;
  }
}
