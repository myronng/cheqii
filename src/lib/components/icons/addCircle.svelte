<script lang="ts">
  import type { ComponentProps } from "svelte";

  import Icon from "$lib/components/icons/icon.svelte";

  let props: ComponentProps<typeof Icon> = $props();
</script>

<Icon {...props}>
  <path
    d="M12 8v8m4-4H8m14 0c0-5.523-4.477-10-10-10S2 6.477 2 12s4.477 10 10 10s10-4.477 10-10"
  />
</Icon>
