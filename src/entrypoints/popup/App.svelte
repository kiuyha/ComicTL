<script lang="ts">
  import { onMount } from 'svelte';

  let apiKey = '';
  let status = '';

  // Load saved key on startup
  onMount(async () => {
    apiKey = await storage.getItem('local:geminiApiKey') || '';
  });

  async function saveKey() {
    await storage.setItem('local:geminiApiKey', apiKey);
    status = 'Saved!';
    console.log('Saved!');
    setTimeout(() => status = '', 2000);
  }
</script>

<main class="p-4 w-64">
  <h1 class="text-lg font-bold mb-4">ComicTL Settings</h1>
  
  <div class="mb-4">
    <label class="block text-sm font-medium mb-1">Gemini API Key</label>
    <input 
      type="password" 
      bind:value={apiKey} 
      class="w-full p-2 border rounded"
      placeholder="AIzaSy..."
    />
  </div>

  <button 
    on:click={saveKey}
    class="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
  >
    Save Configuration
  </button>
  
  {#if status}
    <p class="text-green-600 text-sm mt-2 text-center">{status}</p>
  {/if}
</main>