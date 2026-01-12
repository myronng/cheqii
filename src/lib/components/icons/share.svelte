<script lang="ts">
  import type { ComponentProps } from "svelte";

  import Icon from "$lib/components/icons/icon.svelte";

  let props: ComponentProps<typeof Icon> = $props();
</script>

<Icon {...props}>
  <path
    d="M21 6.5a3 3 0 1 1-6 0a3 3 0 0 1 6 0M9 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0m12 5.5a3 3 0 1 1-6 0a3 3 0 0 1 6 0M8.729 10.75l6.5-3m-6.5 5.5l6.5 3"
  />
</Icon>
