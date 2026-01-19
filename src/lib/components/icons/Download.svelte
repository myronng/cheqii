<script lang="ts">
  import type { ComponentProps } from "svelte";

  import Icon from "$lib/components/icons/Icon.svelte";

  let props: ComponentProps<typeof Icon> = $props();
</script>

<Icon {...props}>
  <path
    d="M12 14.5v-10m0 10c-.7 0-2.008-1.994-2.5-2.5m2.5 2.5c.7 0 2.008-1.994 2.5-2.5m5.5 4.5c0 2.482-.518 3-3 3H7c-2.482 0-3-.518-3-3"
  />
</Icon>
