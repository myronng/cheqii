<script lang="ts">
  import type { ComponentProps } from "svelte";
  import TablerSettings from "~icons/tabler/settings";
  import Icon from "$lib/components/icons/Icon.svelte";

  let props: Omit<ComponentProps<typeof Icon>, "icon"> = $props();
</script>

<Icon icon={TablerSettings} {...props} />
