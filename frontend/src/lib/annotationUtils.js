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

const selectionTouchesExistingAnnotation = (editor, range) => {
  const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE
    ? range.endContainer
    : range.endContainer.parentElement;

  if (startElement?.closest?.('[data-lock-id], [data-comment-id]')) return true;
  if (endElement?.closest?.('[data-lock-id], [data-comment-id]')) return true;

  const fragment = range.cloneContents();
  return Boolean(fragment.querySelector?.('[data-lock-id], [data-comment-id]'));
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

export const wrapSelectionWithAnnotation = (editor, type, id) => {
  const snapshot = getSelectionSnapshot(editor);
  if (!snapshot) {
    return { error: 'Select some text first.' };
  }

  if (selectionTouchesExistingAnnotation(editor, snapshot.range)) {
    return { error: 'Selections that already contain a comment or lock cannot be wrapped again.' };
  }

  const wrapper = window.document.createElement('span');
  if (type === 'comment') {
    wrapper.setAttribute('data-comment-id', id);
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

  const selection = window.getSelection();
  selection.removeAllRanges();

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

export const decorateEditorAnnotations = (editor) => {
  if (!editor) return;

  editor.querySelectorAll('[data-lock-id]').forEach((element) => {
    element.setAttribute('contenteditable', 'false');
    element.setAttribute('title', 'Locked by owner');
  });

  editor.querySelectorAll('[data-comment-id]').forEach((element) => {
    element.setAttribute('title', 'Commented selection');
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
