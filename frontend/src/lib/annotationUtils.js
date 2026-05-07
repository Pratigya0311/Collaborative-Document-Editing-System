const selectionBelongsToEditor = (editor, range) => {
  if (!editor || !range) return false;
  const container = range.commonAncestorContainer;
  return container === editor || editor.contains(container);
};

const serializeFragment = (fragment) => {
  const container = window.document.createElement('div');
  container.appendChild(fragment.cloneNode(true));
  return container.innerHTML;
};

const selectionTouchesExistingAnnotation = (editor, range, type) => {
  const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE
    ? range.endContainer
    : range.endContainer.parentElement;
  const blockedSelector = type === 'lock'
    ? '[data-lock-id]'
    : '[data-lock-id], [data-comment-id]';

  if (startElement?.closest?.(blockedSelector)) return true;
  if (endElement?.closest?.(blockedSelector)) return true;

  const fragment = range.cloneContents();
  return Boolean(fragment.querySelector?.(blockedSelector));
};

export const getSelectionSnapshot = (editor) => {
  const selection = window.getSelection();
  if (!editor || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!selectionBelongsToEditor(editor, range)) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) {
    return null;
  }

  return {
    selection,
    range,
    text,
    html: serializeFragment(range.cloneContents()),
  };
};

export const getSelectedCommentAnchor = (editor) => {
  const selection = window.getSelection();
  if (!editor || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!selectionBelongsToEditor(editor, range)) {
    return null;
  }

  const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE
    ? range.endContainer
    : range.endContainer.parentElement;
  const startComment = startElement?.closest?.('[data-comment-id]');
  const endComment = endElement?.closest?.('[data-comment-id]');

  if (startComment && startComment === endComment) {
    return startComment.getAttribute('data-comment-id');
  }

  const fragmentComment = range.cloneContents().querySelector?.('[data-comment-id]');
  return fragmentComment?.getAttribute('data-comment-id') || null;
};

export const wrapSelectionWithAnnotation = (editor, type, id) => {
  const snapshot = getSelectionSnapshot(editor);
  if (!snapshot) {
    return { error: 'Select some text first.' };
  }

  if (selectionTouchesExistingAnnotation(editor, snapshot.range, type)) {
    return {
      error: type === 'lock'
        ? 'This selected text is already locked.'
        : 'This selected text already has a comment'
    };
  }

  const wrapper = window.document.createElement('span');
  if (type === 'comment') {
    wrapper.setAttribute('data-comment-id', id);
    wrapper.setAttribute('data-selected-text', snapshot.text);
    wrapper.className = 'comment-anchor';
  } else if (type === 'lock') {
    wrapper.setAttribute('data-lock-id', id);
    wrapper.className = 'locked-text';
    wrapper.setAttribute('contenteditable', 'false');
    wrapper.setAttribute('title', 'Locked by owner');
  } else {
    return { error: 'Unsupported annotation type.' };
  }

  const fragment = snapshot.range.extractContents();
  wrapper.appendChild(fragment);
  snapshot.range.insertNode(wrapper);
  moveCaretAfterElement(wrapper);

  return {
    id,
    text: wrapper.textContent || '',
    html: wrapper.innerHTML,
  };
};

export const unwrapAnnotation = (editor, selector) => {
  if (!editor) return false;
  const target = editor.querySelector(selector);
  if (!target) return false;

  const parent = target.parentNode;
  while (target.firstChild) {
    parent.insertBefore(target.firstChild, target);
  }
  parent.removeChild(target);
  return true;
};

export const moveCaretAfterElement = (element) => {
  if (!element) return false;

  const selection = window.getSelection();
  const range = window.document.createRange();
  range.setStartAfter(element);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
};

const isCaretAtEndOfElement = (range, element) => {
  if (!range || !element) return false;

  const probe = range.cloneRange();
  probe.selectNodeContents(element);
  probe.setStart(range.startContainer, range.startOffset);
  return probe.toString().length === 0;
};

export const moveCaretOutOfProtectedPosition = (editor) => {
  const selection = window.getSelection();
  if (!editor || !selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  if (!selectionBelongsToEditor(editor, range)) return false;

  const node = range.startContainer;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const lock = element?.closest?.('[data-lock-id]');
  if (lock && editor.contains(lock)) {
    return moveCaretAfterElement(lock);
  }

  const comment = element?.closest?.('[data-comment-id]');
  if (!comment || !editor.contains(comment)) return false;

  if (isCaretAtEndOfElement(range, comment)) {
    return moveCaretAfterElement(comment);
  }

  return false;
};

export const repairCommentBoundaries = (editor, comments = []) => {
  if (!editor) return false;

  let changed = false;
  const selection = window.getSelection();
  const selectedTextByAnchor = new Map(
    comments.map((comment) => [comment.anchor_id, comment.selected_text])
  );

  editor.querySelectorAll('[data-comment-id]').forEach((element) => {
    const anchorId = element.getAttribute('data-comment-id');
    const selectedText = selectedTextByAnchor.get(anchorId) || element.getAttribute('data-selected-text');
    const currentText = element.textContent || '';

    if (!selectedText || currentText === selectedText || !currentText.startsWith(selectedText)) {
      return;
    }

    const extraText = currentText.slice(selectedText.length);
    const selectionWasInsideComment = Boolean(
      selection &&
      selection.rangeCount > 0 &&
      element.contains(selection.getRangeAt(0).startContainer)
    );
    element.textContent = selectedText;
    element.setAttribute('data-selected-text', selectedText);

    if (extraText) {
      const extraNode = window.document.createTextNode(extraText);
      element.parentNode.insertBefore(extraNode, element.nextSibling);

      if (selectionWasInsideComment) {
        const range = window.document.createRange();
        range.setStart(extraNode, extraNode.length);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    changed = true;
  });

  return changed;
};

export const getMissingCommentAnchors = (editor, comments = []) => {
  if (!editor) return [];

  return comments.filter((comment) => (
    !editor.querySelector(`[data-comment-id="${comment.anchor_id}"]`)
  ));
};

export const decorateEditorAnnotations = (editor, comments = [], locks = [], canLock = false) => {
  if (!editor) return;

  const commentsByAnchor = new Map(
    comments.map((comment) => [comment.anchor_id, comment])
  );
  const locksById = new Map(
    locks.map((lock) => [lock.lock_id, lock])
  );

  editor.querySelectorAll('[data-lock-id]').forEach((element) => {
    const lock = locksById.get(element.getAttribute('data-lock-id'));
    const owner = lock?.created_by_name || 'Owner';
    const action = canLock ? 'Click to unlock.' : 'Only the owner can unlock it.';

    element.setAttribute('contenteditable', 'false');
    element.removeAttribute('title');
    element.setAttribute('data-tooltip-type', 'Locked text');
    element.setAttribute('data-tooltip-body', 'Protected from editing');
    element.setAttribute('data-tooltip-meta', `Locked by ${owner}`);
    element.setAttribute('data-tooltip-action', canLock ? 'Unlock' : action);
  });

  editor.querySelectorAll('[data-comment-id]').forEach((element) => {
    const comment = commentsByAnchor.get(element.getAttribute('data-comment-id'));
    const author = comment?.user_name || 'Someone';
    const body = comment?.body || 'Commented selection';

    element.removeAttribute('title');
    element.setAttribute('data-tooltip-type', 'Comment');
    element.setAttribute('data-tooltip-body', body);
    element.setAttribute('data-tooltip-meta', `By ${author}`);
    element.setAttribute('data-tooltip-action', 'Delete');
  });
};

export const focusAnnotation = (editor, selector) => {
  if (!editor) return false;
  const target = editor.querySelector(selector);
  if (!target) return false;

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('annotation-flash');
  window.setTimeout(() => target.classList.remove('annotation-flash'), 1600);
  return true;
};
