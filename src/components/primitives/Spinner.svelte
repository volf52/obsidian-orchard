<script lang="ts">
type SpinnerProps = {
  size?: number
  color?: string
  speed?: number
}

const { size = 24, color = "#3b82f6", speed = 1 }: SpinnerProps = $props()

const animationDuration = $derived(`${1.2 / speed}s`)
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  xmlns="http://www.w3.org/2000/svg"
  style:--animation-duration={animationDuration}
  class="spinner"
>
  <!-- Background ring -->
  <circle
    cx="12"
    cy="12"
    r="10"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    opacity="0.25"
    style:color={color}
  />
  <!-- Animated foreground ring -->
  <circle
    cx="12"
    cy="12"
    r="10"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-dasharray="15.708 47.124"
    style:color={color}
    class="spinner-ring"
  />
</svg>

<style>
  .spinner {
    animation: spin var(--animation-duration) linear infinite;
  }

  .spinner-ring {
    animation: none;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
