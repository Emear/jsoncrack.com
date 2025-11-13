import React from "react";
import type { ModalProps } from "@mantine/core";
import {
  Modal,
  Stack,
  Text,
  ScrollArea,
  Flex,
  CloseButton,
  Button,
  TextInput,
} from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj: Record<string, unknown> = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// extract editable fields as key -> string (for inputs)
const extractEditableFields = (nodeRows: NodeData["text"]) => {
  const fields: Record<string, string> = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object" && row.key) {
      fields[row.key] =
        row.value === null || row.value === undefined ? "" : String(row.value);
    }
  });
  return fields;
};

// parse string back into JSON-ish value
const parseDraftValue = (raw: string): any => {
  const trimmed = raw.trim();

  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }

  return raw;
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);

  const [isEditing, setIsEditing] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  // whenever a new node is selected / modal opens, reset form
  React.useEffect(() => {
    if (nodeData?.text) {
      setFields(extractEditableFields(nodeData.text));
    } else {
      setFields({});
    }
    setIsEditing(false);
  }, [nodeData, opened]);

  const handleCancel = React.useCallback(() => {
    if (nodeData?.text) {
      setFields(extractEditableFields(nodeData.text));
    }
    setIsEditing(false);
  }, [nodeData]);

  const handleSave = React.useCallback(() => {
    if (!nodeData) {
      setIsEditing(false);
      return;
    }

    try {
      const currentJson = useJson.getState().getJson();
      const root = currentJson ? JSON.parse(currentJson) : {};

      const path = nodeData.path ?? [];
      let nodeTarget: any = root;

      if (path.length > 0) {
        let parent: any = root;
        for (let i = 0; i < path.length - 1; i += 1) {
          parent = parent[path[i] as any];
          if (parent === undefined) {
            console.warn("Invalid path while updating node", path);
            setIsEditing(false);
            return;
          }
        }
        const lastKey = path[path.length - 1] as any;
        nodeTarget = parent[lastKey];

        // if the node is an object, update its fields
        if (nodeTarget && typeof nodeTarget === "object" && !Array.isArray(nodeTarget)) {
          Object.entries(fields).forEach(([key, value]) => {
            nodeTarget[key] = parseDraftValue(value);
          });
        } else {
          // primitive value node: use the first field value
          const firstFieldValue = Object.values(fields)[0];
          parent[lastKey] = parseDraftValue(firstFieldValue ?? "");
        }
      } else {
        // root node case
        if (typeof nodeTarget === "object" && !Array.isArray(nodeTarget)) {
          Object.entries(fields).forEach(([key, value]) => {
            nodeTarget[key] = parseDraftValue(value);
          });
        } else {
          const firstFieldValue = Object.values(fields)[0];
          nodeTarget = parseDraftValue(firstFieldValue ?? "");
        }
      }

      const updatedJson = JSON.stringify(root, null, 2);

      // update JSON store (graph) + left editor contents
      useJson.getState().setJson(updatedJson);
      useFile.getState().setContents({ contents: updatedJson });

      setIsEditing(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to update JSON from NodeModal", err);
      setIsEditing(false);
    }
  }, [fields, nodeData]);

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Flex align="center" gap="xs">
              {isEditing ? (
                <>
                  <Button size="xs" color="green" onClick={handleSave}>
                    Save
                  </Button>
                  <Button size="xs" color="red" variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button size="xs" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
              <CloseButton onClick={onClose} />
            </Flex>
          </Flex>

          {isEditing ? (
            <ScrollArea.Autosize mah={250} maw={600}>
              <Stack gap="xs" miw={350} maw={600}>
                {Object.keys(fields).length === 0 ? (
                  <Text fz="xs" c="dimmed">
                    No editable fields for this node.
                  </Text>
                ) : (
                  Object.entries(fields).map(([key, value]) => (
                    <Stack key={key} gap={2}>
                      <Text fz="xs" fw={500}>
                        {key}
                      </Text>
                      <TextInput
                        size="xs"
                        value={value}
                        onChange={e =>
                          setFields(prev => ({
                            ...prev,
                            [key]: e.currentTarget.value,
                          }))
                        }
                      />
                    </Stack>
                  ))
                )}
              </Stack>
            </ScrollArea.Autosize>
          ) : (
            <ScrollArea.Autosize mah={250} maw={600}>
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            </ScrollArea.Autosize>
          )}
        </Stack>

        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
