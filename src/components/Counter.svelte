<script lang="ts">
interface Props {
  startCount: number
}

const { startCount }: Props = $props()
let _count = $state(startCount)

export function increment() {
  _count += 1
}
</script>

<div class="number">
  <span>My number is {count}!</span>
</div>

<button onclick={increment}>++</button>

<style>
  .number {
    color: red;
  }

  button {
    border-radius: 0.5rem;
    border: 1px solid indigo;
    padding: 0.5rem 1rem;
    margin: 0.5rem 0.5rem;
  }
</style>
