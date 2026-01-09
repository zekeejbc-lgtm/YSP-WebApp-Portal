import React from 'react';

interface FormattedTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * FormattedText Component
 * 
 * Parses and renders text with:
 * - Clickable links (orange color)
 * - Orange hashtags
 * - Bold text (**text** or __text__)
 * - Headers (## Header) rendered as bold text
 * - Preserves emojis, line breaks, and original formatting
 */
export function FormattedText({ text, className = '', style = {} }: FormattedTextProps) {
  if (!text) return null;

  const formatInlineContent = (content: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    
    // Combined regex to match all patterns in order
    // Group 1: URLs, Group 2: Bold (**), Group 3: bold content, Group 4: Bold (__), Group 5: __ content, Group 6: Hashtags
    const regex = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)|(\*\*([^*]+)\*\*)|(__([^_]+)__)|(#[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]+)/g;
    
    let lastIndex = 0;
    let match;
    let keyIndex = 0;

    while ((match = regex.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        elements.push(
          <React.Fragment key={`text-${keyIndex++}`}>
            {content.substring(lastIndex, match.index)}
          </React.Fragment>
        );
      }

      if (match[1]) {
        // URL match
        const url = match[1];
        const href = url.startsWith('www.') ? `https://${url}` : url;
        elements.push(
          <a
            key={`link-${keyIndex++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#f6421f',
              textDecoration: 'underline',
              fontWeight: 500,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {url}
          </a>
        );
      } else if (match[2] || match[4]) {
        // Bold match (**text** or __text__)
        const boldContent = match[3] || match[5];
        elements.push(
          <strong key={`bold-${keyIndex++}`} style={{ fontWeight: 'bold' }}>
            {boldContent}
          </strong>
        );
      } else if (match[6]) {
        // Hashtag match
        elements.push(
          <span
            key={`hashtag-${keyIndex++}`}
            style={{
              color: '#f6421f',
              fontWeight: 600,
            }}
          >
            {match[6]}
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after the last match
    if (lastIndex < content.length) {
      elements.push(
        <React.Fragment key={`text-${keyIndex++}`}>
          {content.substring(lastIndex)}
        </React.Fragment>
      );
    }

    // If no matches found, return the original content
    if (elements.length === 0) {
      return [<React.Fragment key="original">{content}</React.Fragment>];
    }

    return elements;
  };

  const formatLine = (line: string, lineKey: number): React.ReactNode => {
    // Check if line is a header (starts with # or ##)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const headerLevel = headerMatch[1].length;
      const headerText = headerMatch[2];
      const fontSize = headerLevel === 1 ? '1.5em' : headerLevel === 2 ? '1.3em' : '1.1em';
      return (
        <span key={lineKey} style={{ fontWeight: 'bold', fontSize, display: 'block', marginTop: '0.5em', marginBottom: '0.25em' }}>
          {formatInlineContent(headerText)}
        </span>
      );
    }
    return <React.Fragment key={lineKey}>{formatInlineContent(line)}</React.Fragment>;
  };

  // Split by newlines and process each line
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];

  lines.forEach((line, index) => {
    result.push(formatLine(line, index));
    // Add line break after each line except the last
    if (index < lines.length - 1) {
      result.push(<br key={`br-${index}`} />);
    }
  });

  return (
    <span className={className} style={{ ...style, whiteSpace: 'pre-wrap' }}>
      {result}
    </span>
  );
}

export default FormattedText;
