// Tests for client/src/hooks/use-toast.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { reducer, toast } from "@/hooks/use-toast";

describe("toast reducer", () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  it("should add a toast to empty state", () => {
    const initialState = { toasts: [] };
    const newToast = {
      id: "1",
      title: "Test",
      description: "Test toast",
      open: true,
    };

    const result = reducer(initialState, {
      type: "ADD_TOAST",
      toast: newToast,
    });

    expect(result.toasts).toHaveLength(1);
    expect(result.toasts[0]).toEqual(newToast);
  });

  it("should limit toasts to TOAST_LIMIT (1)", () => {
    const initialState = {
      toasts: [
        { id: "1", title: "First", open: true },
      ],
    };

    const newToast = {
      id: "2",
      title: "Second",
      open: true,
    };

    const result = reducer(initialState, {
      type: "ADD_TOAST",
      toast: newToast,
    });

    expect(result.toasts).toHaveLength(1);
    expect(result.toasts[0].id).toBe("2");
  });

  it("should add new toast to the beginning of the array", () => {
    const initialState = { toasts: [] };
    const firstToast = { id: "1", title: "First", open: true };
    
    const state1 = reducer(initialState, {
      type: "ADD_TOAST",
      toast: firstToast,
    });
    
    expect(state1.toasts[0]).toEqual(firstToast);
  });

  it("should update an existing toast", () => {
    const initialState = {
      toasts: [
        { id: "1", title: "Original", open: true },
        { id: "2", title: "Second", open: true },
      ],
    };

    const result = reducer(initialState, {
      type: "UPDATE_TOAST",
      toast: { id: "1", title: "Updated" },
    });

    expect(result.toasts[0].title).toBe("Updated");
    expect(result.toasts[1].title).toBe("Second");
  });

  it("should not modify other toasts when updating", () => {
    const initialState = {
      toasts: [
        { id: "1", title: "First", description: "Desc1", open: true },
        { id: "2", title: "Second", description: "Desc2", open: true },
      ],
    };

    const result = reducer(initialState, {
      type: "UPDATE_TOAST",
      toast: { id: "2", description: "Updated Description" },
    });

    expect(result.toasts[0]).toEqual(initialState.toasts[0]);
    expect(result.toasts[1].description).toBe("Updated Description");
    expect(result.toasts[1].title).toBe("Second");
  });

  it("should dismiss a specific toast by ID", () => {
    vi.useFakeTimers();
    
    const initialState = {
      toasts: [
        { id: "1", title: "First", open: true },
        { id: "2", title: "Second", open: true },
      ],
    };

    const result = reducer(initialState, {
      type: "DISMISS_TOAST",
      toastId: "1",
    });

    expect(result.toasts[0].open).toBe(false);
    expect(result.toasts[1].open).toBe(true);
    
    vi.useRealTimers();
  });

  it("should dismiss all toasts when toastId is undefined", () => {
    vi.useFakeTimers();
    
    const initialState = {
      toasts: [
        { id: "1", title: "First", open: true },
        { id: "2", title: "Second", open: true },
      ],
    };

    const result = reducer(initialState, {
      type: "DISMISS_TOAST",
      toastId: undefined,
    });

    expect(result.toasts[0].open).toBe(false);
    expect(result.toasts[1].open).toBe(false);
    
    vi.useRealTimers();
  });

  it("should remove a specific toast by ID", () => {
    const initialState = {
      toasts: [
        { id: "1", title: "First", open: true },
        { id: "2", title: "Second", open: true },
      ],
    };

    const result = reducer(initialState, {
      type: "REMOVE_TOAST",
      toastId: "1",
    });

    expect(result.toasts).toHaveLength(1);
    expect(result.toasts[0].id).toBe("2");
  });

  it("should remove all toasts when toastId is undefined", () => {
    const initialState = {
      toasts: [
        { id: "1", title: "First", open: true },
        { id: "2", title: "Second", open: true },
      ],
    };

    const result = reducer(initialState, {
      type: "REMOVE_TOAST",
      toastId: undefined,
    });

    expect(result.toasts).toHaveLength(0);
  });

  it("should keep toasts when removing non-existent ID", () => {
    const initialState = {
      toasts: [
        { id: "1", title: "First", open: true },
        { id: "2", title: "Second", open: true },
      ],
    };

    const result = reducer(initialState, {
      type: "REMOVE_TOAST",
      toastId: "non-existent",
    });

    expect(result.toasts).toHaveLength(2);
  });
});

describe("toast function", () => {
  it("should create a toast with title and description", () => {
    const result = toast({
      title: "Success",
      description: "Operation completed",
    });

    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe("string");
    expect(result.dismiss).toBeInstanceOf(Function);
    expect(result.update).toBeInstanceOf(Function);
  });

  it("should create a toast with only title", () => {
    const result = toast({
      title: "Info",
    });

    expect(result.id).toBeDefined();
  });

  it("should generate unique IDs for multiple toasts", () => {
    const toast1 = toast({ title: "First" });
    const toast2 = toast({ title: "Second" });
    const toast3 = toast({ title: "Third" });

    expect(toast1.id).not.toBe(toast2.id);
    expect(toast2.id).not.toBe(toast3.id);
    expect(toast1.id).not.toBe(toast3.id);
  });

  it("should create toast with variant", () => {
    const result = toast({
      title: "Error",
      variant: "destructive",
    });

    expect(result.id).toBeDefined();
  });

  it("should create toast with action", () => {
    const mockAction = {
      altText: "Undo",
      onClick: vi.fn(),
    };

    const result = toast({
      title: "Changed",
      action: mockAction as any,
    });

    expect(result.id).toBeDefined();
  });
});
