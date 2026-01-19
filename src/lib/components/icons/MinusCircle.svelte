<script lang="ts">
  import type { ComponentProps } from "svelte";

  import Icon from "$lib/components/icons/Icon.svelte";

  let props: ComponentProps<typeof Icon> = $props();
</script>

<Icon {...props}>
  <path d="M16 12H8" />
  <circle cx="12" cy="12" r="10" />
</Icon>
