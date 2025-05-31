<script lang="ts">
  import { getContext, onMount, type Snippet } from "svelte";

  type TabsContext = {
    activeTabId: string;
    registerTab: (id: string, label: string, disabled?: boolean) => void;
    setActiveTab: (id: string) => void;
  };
  const ctx = getContext<TabsContext>("tabs-ctx");
  if (!ctx) {
    throw new Error("TabPanel must be used within a Tabs context");
  }

  type TabPanelProps = {
    children: Snippet;
    label: string;
    id?: string;
    disabled?: boolean;
    class?: string;
  };

  const {
    children,
    label,
    id = crypto.randomUUID(),
    disabled = false,
    class: className = "",
  }: TabPanelProps = $props();

  onMount(() => {
    ctx.registerTab(id, label, disabled);
  });

  const isActive = $derived(ctx.activeTabId === id);
</script>

{#if isActive}
  <div class="tab-panel {className}">
    {@render children()}
  </div>
{/if}

<style>
  .tab-panel {
    animation: fadeIn 0.2s ease-in;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
