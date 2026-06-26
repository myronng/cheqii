<script lang="ts">
  import type { ComponentProps } from "svelte";
  import TablerIcon from "~icons/tabler/x";
  import Icon from "$lib/components/icons/Icon.svelte";

  let props: Omit<ComponentProps<typeof Icon>, "icon"> = $props();
</script>

<Icon icon={TablerIcon} {...props} />
