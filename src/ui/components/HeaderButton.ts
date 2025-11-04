import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * HeaderButton component - displays a square button with an icon in the header
 */
@customElement('header-button')
export class HeaderButton extends LitElement {
  static styles = css`
    :host {
      display: inline-block;
      cursor: pointer;
    }

    button {
      width: 3rem; /* 48px - square button */
      height: 3rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem; /* text-2xl */
      border-radius: 0.375rem; /* rounded-md */
      box-shadow:
        0 20px 25px -5px rgb(0 0 0 / 0.1),
        0 8px 10px -6px rgb(0 0 0 / 0.1); /* shadow-xl */
      transition: all 150ms;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0;
    }

    button:hover {
      background-color: white;
      color: black;
    }

    /* Larger size for desktop */
    @media (min-width: 640px) {
      button {
        width: 4rem; /* 64px */
        height: 4rem;
        font-size: 2rem; /* text-3xl */
        border-radius: 0.5rem; /* sm:rounded-lg */
      }
    }
  `;

  @property({ type: String })
  icon = '';

  @property({ type: String })
  title = '';

  private handleClick(e: Event) {
    // Forward the click event to the host element so external listeners work
    this.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <button @click="${this.handleClick}" title="${this.title}" aria-label="${this.title}">
        ${this.icon}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'header-button': HeaderButton;
  }
}
