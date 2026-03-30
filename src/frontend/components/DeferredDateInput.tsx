import { type ComponentPropsWithoutRef, type FocusEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

export type DeferredDateCommitTrigger = "input" | "blur" | "enter";

const isCommittedDateValue = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const shouldAutoCommitDeferredDateInput = ({
  draftValue,
  keyboardEditing,
}: {
  draftValue: string;
  keyboardEditing: boolean;
}): boolean => !keyboardEditing && (draftValue === "" || isCommittedDateValue(draftValue));

export const resolveDeferredDateInputCommit = ({
  appliedValue,
  draftValue,
  trigger,
}: {
  appliedValue: string;
  draftValue: string;
  trigger: DeferredDateCommitTrigger;
}): string | null => {
  if (trigger === "input") return null;
  return draftValue === appliedValue ? null : draftValue;
};

interface DeferredDateInputProps extends Omit<ComponentPropsWithoutRef<"input">, "type" | "value" | "onChange"> {
  value: string;
  onCommit: (value: string) => void;
}

export const DeferredDateInput = ({
  value,
  onCommit,
  onBlur,
  onInput,
  onKeyDown,
  onPointerDown,
  ...props
}: DeferredDateInputProps) => {
  const [draftValue, setDraftValue] = useState(value);
  const keyboardEditingRef = useRef(false);
  const skipNextBlurCommitRef = useRef(false);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const commitDraft = (trigger: DeferredDateCommitTrigger) => {
    const nextCommittedValue = resolveDeferredDateInputCommit({
      appliedValue: value,
      draftValue,
      trigger,
    });

    if (nextCommittedValue !== null) onCommit(nextCommittedValue);
  };

  const handleInput: NonNullable<DeferredDateInputProps["onInput"]> = (event) => {
    const nextValue = event.currentTarget.value;

    setDraftValue(nextValue);
    if (
      shouldAutoCommitDeferredDateInput({
        draftValue: nextValue,
        keyboardEditing: keyboardEditingRef.current,
      }) &&
      nextValue !== value
    ) {
      onCommit(nextValue);
    }
    onInput?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    keyboardEditingRef.current = false;

    if (skipNextBlurCommitRef.current) {
      skipNextBlurCommitRef.current = false;
    } else {
      commitDraft("blur");
    }

    onBlur?.(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      skipNextBlurCommitRef.current = true;
      commitDraft("enter");
      event.currentTarget.blur();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      skipNextBlurCommitRef.current = true;
      keyboardEditingRef.current = false;
      setDraftValue(value);
      event.currentTarget.blur();
    }

    if (!["Enter", "Escape", "Tab", "Shift", "Control", "Alt", "Meta", "CapsLock"].includes(event.key)) {
      keyboardEditingRef.current = true;
    }

    onKeyDown?.(event);
  };

  return (
    <input
      {...props}
      type="date"
      value={draftValue}
      onPointerDown={(event) => {
        keyboardEditingRef.current = false;
        onPointerDown?.(event);
      }}
      onInput={handleInput}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
};
