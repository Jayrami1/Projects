import { useState, useRef } from 'react';
import { parseRichText } from '../utils/richTextParser';
import styles from './RichText.module.css';
// User required for mentioning part
// Parser for this is in src/utils
interface User {
  id: string;
  name: string;
  email: string;
}
interface RichTextProps {
  onSubmit: (content: string) => void;
  initialValue?: string;
  onCancel?: () => void;
  users?: User[];
}

export default function RichText({
  onSubmit,
  initialValue = '',
  onCancel,
  users = [],
}: RichTextProps) {
  const [content, setContent] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  //helper to introduce formatting syntax at the cursor position in the textarea
  function insertFormatting(prefix: string, suffix: string) {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText =
      content.substring(0, start) +
      prefix +
      selectedText +
      suffix +
      content.substring(end);
    setContent(newText);

    //return focus to text area
    setTimeout(() => {
      textarea.focus();
      //place cursor between the prefix and suffix if no text was selected, otherwise keep the text selected
      if (selectedText.length === 0) {
        textarea.setSelectionRange(
          start + prefix.length,
          start + prefix.length
        );
      } else {
        textarea.setSelectionRange(start, end + prefix.length + suffix.length);
      }
    }, 0);
  }
  //dropdown selection for mentioning
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions) {
      const filtered = users.filter(
        (u) =>
          u.name.toLowerCase().includes(mentionQuery) ||
          u.email.toLowerCase().includes(mentionQuery)
      );
      // If user presses Enter or Tab, select the first filtered user
      if (filtered.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
        e.preventDefault();
        handleMentionSelect(filtered[0]);
        return;
      }
      // Close on Escape
      if (e.key === 'Escape') {
        setShowMentions(false);
      }
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    const cursor = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursor);
    // Find the last '@' symbol before the cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    // Check if we should show mentions
    if (lastAtIndex !== -1) {
      // Extract the string between the '@' and the cursor (the query)
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      // Don't show if there is a space in the query (WhatsApp stops searching on space)
      // Don't show if the '@' is preceded by a character (should be start of line or preceded by a space)
      const charBeforeAt =
        lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : '';
      const isValidTrigger = lastAtIndex === 0 || /\s/.test(charBeforeAt);
      if (isValidTrigger && !query.includes(' ')) {
        setShowMentions(true);
        setMentionQuery(query.toLowerCase());
        return;
      }
    }
    // Default to hiding the dropdown
    setShowMentions(false);
  };
  const handleMentionSelect = (user: User) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const cursor = textarea.selectionStart || content.length;

    const textBeforeCursor = content.slice(0, cursor);
    const textAfterCursor = content.slice(cursor);
    // Replace the "@query" with "@[UserName](email@domain.com) "
    const newTextBefore = textBeforeCursor.replace(
      /@([a-zA-Z0-9_.\- ]*)$/,
      `@[${user.name}](${user.email}) `
    );
    setContent(newTextBefore + textAfterCursor);
    setShowMentions(false);
    // Return focus so they can keep typing
    setTimeout(() => textarea.focus(), 0);
  };
  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content);
      setContent('');
    }
  };

  return (
    <div className={styles.editorContainer}>
      {/* TOOLBAR */}
      <div className={styles.toolbar}>
        <button
          type="button"
          onClick={() => insertFormatting('**', '**')}
          title="Bold"
        >
          <b>B</b>
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('*', '*')}
          title="Italic"
        >
          <i>I</i>
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('__', '__')}
          title="Underline"
        >
          <u>U</u>
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('~~', '~~')}
          title="Strikethrough"
        >
          <del>S</del>
        </button>
        <div className={styles.divider}></div>
        <button
          type="button"
          onClick={() => insertFormatting('`', '`')}
          title="Inline Code"
        >
          Code
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('[', '](url)')}
          title="Add Link"
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('- ', '')}
          title="Bullet List"
        >
          • List
        </button>
      </div>

      {/* TEXT AREA WITH MENTIONS */}
      <div className={styles.mentionsWrapper}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment... Use the toolbar, markdown, or type @ to mention someone."
          className={styles.textArea}
        />
        {/* THE MENTIONS DROPDOWN MENU */}
        {showMentions && users && users.length > 0 && (
          <div className={styles.mentionsDropdown}>
            {users
              .filter(
                (u) =>
                  u.name.toLowerCase().includes(mentionQuery) ||
                  u.email.toLowerCase().includes(mentionQuery)
              )
              .map((u) => (
                <div
                  key={u.id}
                  onClick={() => handleMentionSelect(u)}
                  className={styles.mentionItem}
                >
                  <div className={styles.mentionName}>{u.name}</div>
                  <div className={styles.mentionEmail}>{u.email}</div>
                </div>
              ))}

            {/* Fallback if no user matches the search */}
            {users.filter(
              (u) =>
                u.name.toLowerCase().includes(mentionQuery) ||
                u.email.toLowerCase().includes(mentionQuery)
            ).length === 0 && (
              <div className={styles.mentionFallback}>No users found.</div>
            )}
          </div>
        )}
      </div>
      {/* FOOTER: PREVIEW & SUBMIT */}
      <div className={styles.footer}>
        <div className={styles.previewContainer}>
          <span className={styles.previewLabel}>Live Preview:</span>
          {content.trim() ? (
            <div
              className={styles.formattedContent}
              dangerouslySetInnerHTML={{ __html: parseRichText(content) }}
            />
          ) : (
            <div className={styles.emptyPreview}>Nothing to preview yet...</div>
          )}
        </div>
        <div>
          {onCancel && (
            <button
              className={styles.cancelBtn}
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}

          <button
            onClick={handleSubmit}
            disabled={!content.trim()}
            className={styles.submitBtn}
          >
            {initialValue ? 'Save Changes' : 'Post Comment'}
          </button>
        </div>
      </div>
    </div>
  );
}
