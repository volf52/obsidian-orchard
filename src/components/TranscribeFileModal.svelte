<script lang="ts">
  import FileSettingItem from "./primitives/FileSettingItem.svelte";
  import ModalContent from "./primitives/ModalContent.svelte";

  type TranscribeFileModalProps = {
    onSubmit: (
      file: File,
      onErr: (_data: string, err: unknown) => void,
    ) => void;
  };

  const { onSubmit }: TranscribeFileModalProps = $props();

  let file = $state<File | null>(null);

  const handleSubmit = () => {
    if (!file) {
      return;
    }

    onSubmit(file, (_errVal, _err) => {});
  };

  const setFile = (selectedFile: File) => {
    file = selectedFile;
  };
</script>

<ModalContent onSubmit={handleSubmit}>
  <FileSettingItem name="File to transcribe" fullWidth {setFile} />
</ModalContent>
