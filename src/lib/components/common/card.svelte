<section>
  <slot />
</section>

<style>
  section {
    background-color: var(--color-background-surface);
    backdrop-filter: blur(var(--length-surface-blur));
    border: 1px solid var(--color-divider);
    border-radius: var(--length-radius);
    display: flex;
    flex-direction: column;
    padding: var(--length-spacing);
  }
</style>