<div class="loader">
  <div></div>
  <div></div>
  <div></div>
  <div></div>
</div>

<style>
  .loader {
    /* The dots are absolutely positioned, so give the box their real footprint
       (last dot starts at 88px + a 1rem ball) — otherwise flex centering treats
       the loader as zero-size and the dots render off-center. */
    block-size: 1rem;
    inline-size: calc(88px + 1rem);
    position: relative;
  }
  .loader div {
    animation-timing-function: cubic-bezier(0, 1, 1, 0);
    background: var(--color-action-secondary);
    block-size: 1rem;
    border-radius: 50%;
    inline-size: 1rem;
    position: absolute;
  }
  .loader div:nth-child(1) {
    animation: loader1 0.6s infinite;
    left: 8px;
  }
  .loader div:nth-child(2) {
    animation: loader2 0.6s infinite;
    left: 8px;
  }
  .loader div:nth-child(3) {
    animation: loader2 0.6s infinite;
    left: 48px;
  }
  .loader div:nth-child(4) {
    animation: loader3 0.6s infinite;
    left: 88px;
  }

  @keyframes loader1 {
    0% {
      transform: scale(0);
    }
    100% {
      transform: scale(1);
    }
  }

  @keyframes loader2 {
    0% {
      transform: translate(0, 0);
    }
    100% {
      transform: translate(40px, 0);
    }
  }

  @keyframes loader3 {
    0% {
      transform: scale(1);
    }
    100% {
      transform: scale(0);
    }
  }
</style>
