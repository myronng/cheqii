<script lang="ts">
  import type { ComponentProps } from "svelte";

  import Icon from "$lib/components/icons/icon.svelte";

  let props: ComponentProps<typeof Icon> = $props();
</script>

<Icon {...props}>
  <circle cx="12" cy="12" r="11" />
  <path
    d="M7.5 17C9.8317 14.5578 14.1432 14.4428 16.5 17M14.4951 9.5C14.4951 10.8807 13.3742 12 11.9915 12C10.6089 12 9.48797 10.8807 9.48797 9.5C9.48797 8.11929 10.6089 7 11.9915 7C13.3742 7 14.4951 8.11929 14.4951 9.5Z"
    stroke-linecap="round"
  />
</Icon>
