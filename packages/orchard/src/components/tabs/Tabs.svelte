<script lang="ts">
import { type Snippet, setContext } from "svelte"
import { SvelteMap } from "svelte/reactivity"

type TabsProps = {
  children: Snippet
  class?: string
  defaultTab?: string
}

type TabData = {
  id: string
  label: string
  disabled?: boolean
}

type TabsContext = {
  activeTabId: string
  tabs: Map<string, TabData>
  registerTab: (id: string, label: string, disabled?: boolean) => void
  setActiveTab: (id: string) => void
}

const { children, defaultTab, class: className = "" }: TabsProps = $props()

let activeTab = $state<string>(defaultTab || "")
let tabsData = new SvelteMap<string, TabData>()

const tabsContext: TabsContext = {
  get activeTabId() {
    return activeTab
  },
  get tabs() {
    return tabsData
  },
  registerTab: (id, label, disabled = false) => {
    const newTab: TabData = { id, label, disabled }

    tabsData.set(id, newTab)

    if (!activeTab && !disabled) {
      activeTab = id
    }
  },
  setActiveTab: (id) => {
    const tab = tabsData.get(id)

    if (tab && !tab.disabled) {
      activeTab = id
    }
  },
}

setContext("tabs-ctx", tabsContext)

const tabsArr = $derived<TabData[]>(Array.from(tabsData.values()))
</script>

<div class="tabs-container {className}">
  <!-- Header -->
  <div class="tab-headers">
    {#each tabsArr as tab (tab.id)}
      <button
        class="tab-header"
        class:active={activeTab === tab.id}
        class:disabled={tab.disabled}
        disabled={tab.disabled}
        onclick={() => tabsContext.setActiveTab(tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- Content -->
  <div class="tab-content">
    {@render children()}
  </div>
</div>

<style>
  .tabs-container {
    width: 100%;
    background-color: var(--tab-container-background);
  }

  .tab-headers {
    display: flex;
    border-bottom: 2px solid #e2e8f0;
    margin-bottom: 1rem;
  }

  .tab-header {
    padding: 0.75rem 1.5rem;
    background: none;
    border: none;
    cursor: pointer;
    font-size: var(--tab-font-size, 1rem);
    font-weight: var(--tab-font-weight, 500);
    color: var(--tab-text-color-focused, #64748b);
    border-bottom: 2px solid transparent;
    transition: all 0.2s ease;
  }

  .tab-header:hover:not(.disabled) {
    /* color: #1e293b; */
    /* background-color: #f8fafc; */
    color: var(--text-color-active, #1e293b);
    background-color: --var(--tab-background-active, #f8fafc);
  }

  .tab-header.active {
    /* color: #3b82f6; */
    color: var(--tab-text-color-focused-active-current, #3b82f6);
    border-bottom-color: #3b82f6;
  }

  .tab-header.disabled {
    color: #cbd5e1;
    cursor: not-allowed;
  }

  .tab-content {
    min-height: 200px;
  }
</style>
