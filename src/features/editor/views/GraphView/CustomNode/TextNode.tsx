import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import type { CustomNodeProps } from ".";
import useConfig from "../../../../../store/useConfig";
import useJson from "../../../../../store/useJson";
import { isContentImage } from "../lib/utils/calculateNodeSize";
import { TextRenderer } from "./TextRenderer";
import * as Styled from "./styles";

const StyledTextNodeWrapper = styled.span<{ $isParent: boolean }>`
  display: flex;
  justify-content: ${({ $isParent }) => ($isParent ? "center" : "flex-start")};
  align-items: center;
  height: 100%;
  width: 100%;
  overflow: hidden;
  padding: 0 10px;
  gap: 6px;
  pointer-events: auto; /* let buttons / inputs be clickable */
`;

const StyledImageWrapper = styled.div`
  padding: 5px;
`;

const StyledImage = styled.img`
  border-radius: 2px;
  object-fit: contain;
  background: ${({ theme }) => theme.BACKGROUND_MODIFIER_ACCENT};
`;

const StyledInput = styled.input`
  flex: 1;
  min-width: 0;
  font-family: monospace;
  font-size: 12px;
  border-radius: 2px;
  border: 1px solid ${({ theme }) => theme.BACKGROUND_MODIFIER_ACCENT};
  padding: 2px 4px;
`;

const SmallButton = styled.button`
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 2px;
  border: 1px solid ${({ theme }) => theme.BACKGROUND_MODIFIER_ACCENT};
  background: ${({ theme }) => theme.BACKGROUND_MODIFIER_ACCENT};
  cursor: pointer;
`;

const Node = ({ node, x, y }: CustomNodeProps) => {
  const { text, width, height, path } = node;
  const imagePreviewEnabled = useConfig(state => state.imagePreviewEnabled);
  const value = text[0].value;
  const isImage = imagePreviewEnabled && isContentImage(String(value));

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(
    value !== null && value !== undefined ? String(value) : ""
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  // keep draft in sync when value changes externally
  useEffect(() => {
    if (!isEditing) {
      setDraft(value !== null && value !== undefined ? String(value) : "");
    }
  }, [value, isEditing]);

  // auto-select text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

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

  const handleCancel = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setDraft(value !== null && value !== undefined ? String(value) : "");
      setIsEditing(false);
    },
    [value]
  );

  const handleSave = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      // no changes, nothing to do
      if (String(value ?? "") === draft) {
        setIsEditing(false);
        return;
      }

      if (!path || !Array.isArray(path) || path.length === 0) {
        setIsEditing(false);
        return;
      }

      try {
        const currentJson = useJson.getState().getJson();
        const parsed = currentJson ? JSON.parse(currentJson) : {};

        let target: any = parsed;
        for (let i = 0; i < path.length - 1; i += 1) {
          const key = path[i] as any;
          if (target[key] === undefined) {
            setIsEditing(false);
            return;
          }
          target = target[key];
        }

        const lastKey = path[path.length - 1] as any;
        target[lastKey] = parseDraftValue(draft);

        const updatedJson = JSON.stringify(parsed, null, 2);
        // updates left JSON editor + graph
        useJson.getState().setJson(updatedJson);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to update JSON from node editor", err);
      }

      setIsEditing(false);
    },
    [draft, path, value]
  );

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = e => {
    e.stopPropagation();
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <Styled.StyledForeignObject
      data-id={`node-${node.id}`}
      width={width}
      height={height}
      x={0}
      y={0}
    >
      {isImage ? (
        <StyledImageWrapper>
          <StyledImage src={String(value)} width="70" height="70" loading="lazy" />
        </StyledImageWrapper>
      ) : (
        <StyledTextNodeWrapper
          data-x={x}
          data-y={y}
          data-key={JSON.stringify(text)}
          $isParent={false}
        >
          {isEditing ? (
            <>
              <StyledInput
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <SmallButton onClick={handleSave}>Save</SmallButton>
              <SmallButton onClick={handleCancel}>Cancel</SmallButton>
            </>
          ) : (
            <>
              <Styled.StyledKey $value={value} $type={typeof value}>
                <TextRenderer>{value}</TextRenderer>
              </Styled.StyledKey>
              <SmallButton onClick={handleEditClick}>Edit</SmallButton>
            </>
          )}
        </StyledTextNodeWrapper>
      )}
    </Styled.StyledForeignObject>
  );
};

function propsAreEqual(prev: CustomNodeProps, next: CustomNodeProps) {
  return (
    prev.node.text === next.node.text &&
    prev.node.width === next.node.width &&
    prev.node.height === next.node.height
  );
}

export const TextNode = React.memo(Node, propsAreEqual);
