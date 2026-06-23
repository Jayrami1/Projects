// text parser to support rich text support
export const parseRichText = (rawText: string): string => {
  if (!rawText) return '';

  let html = rawText // replace the HTML tags with their safe equivalents so that malicious code cannot be typed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // MENTIONS: Hides the email and shows user name and hover names
  html = html.replace(
    /@\[([^\]]+)\]\(([^)]+)\)/g,
    '<strong style="color: #0052cc;" title="$2">@$1</strong>'
  );
  //BOLD
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // UNDERLINE
  html = html.replace(/__(.*?)__/g, '<u>$1</u>');
  //ITALIC (both * and _  )
  html = html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  //STRIKETHROUGH
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
  //INLINE CODE
  html = html.replace(/`(.*?)`/g, '<code class="rich-code">$1</code>');
  //bold is first because it has two asterisks, so it will be replaced first and then the italic will be replaced
  //LINKS
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="rich-link">$1</a>'
  );
  //LISTS
  html = html.replace(/^[ \t]*[-*][ \t]+(.*)$/gm, '<li>$1</li>');
  html = html.replace(
    /(<li>[\s\S]*?<\/li>)/gm,
    '<ul class="rich-list">$1</ul>'
  );
  //LINE BREAKS
  html = html.replace(/\n(?!\s*<\/?(ul|li)>)/g, '<br />');

  return html;
};
