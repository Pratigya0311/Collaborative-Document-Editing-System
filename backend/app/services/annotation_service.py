"""Helpers for comment anchors and locked text spans stored in document HTML."""
from html.parser import HTMLParser
import re


class _SpanByAttributeParser(HTMLParser):
    """Extract a span's inner HTML while respecting nested spans."""

    def __init__(self, attr_name: str, attr_value: str):
        super().__init__(convert_charrefs=False)
        self.attr_name = attr_name
        self.attr_value = str(attr_value)
        self.capturing = False
        self.depth = 0
        self.parts = []
        self.result = None

    def handle_starttag(self, tag, attrs):
        if self.result is not None:
            return

        attrs_dict = dict(attrs)
        if (
            not self.capturing and
            tag.lower() == 'span' and
            attrs_dict.get(self.attr_name) == self.attr_value
        ):
            self.capturing = True
            self.depth = 1
            return

        if self.capturing:
            self.parts.append(self.get_starttag_text())
            self.depth += 1

    def handle_startendtag(self, tag, attrs):
        if self.capturing and self.result is None:
            self.parts.append(self.get_starttag_text())

    def handle_endtag(self, tag):
        if not self.capturing or self.result is not None:
            return

        self.depth -= 1
        if self.depth == 0:
            self.result = ''.join(self.parts)
            self.capturing = False
            return

        self.parts.append(f'</{tag}>')

    def handle_data(self, data):
        if self.capturing and self.result is None:
            self.parts.append(data)

    def handle_entityref(self, name):
        if self.capturing and self.result is None:
            self.parts.append(f'&{name};')

    def handle_charref(self, name):
        if self.capturing and self.result is None:
            self.parts.append(f'&#{name};')


class AnnotationService:
    """Validate and inspect comment and lock span markup."""

    COMMENT_ATTR = 'data-comment-id'
    LOCK_ATTR = 'data-lock-id'

    def find_span(self, html: str, attr_name: str, attr_value: str):
        """Return the span markup carrying the requested data attribute."""
        if not html:
            return None

        parser = _SpanByAttributeParser(attr_name, attr_value)
        parser.feed(html)
        if parser.result is not None:
            inner_html = parser.result
            return {
                'inner_html': inner_html,
                'text': self.strip_tags(inner_html),
                'markup': '',
            }

        pattern = re.compile(
            rf'<span\b(?=[^>]*\b{re.escape(attr_name)}=["\']{re.escape(str(attr_value))}["\'])[^>]*>(.*?)</span>',
            re.IGNORECASE | re.DOTALL
        )
        match = pattern.search(html)
        if not match:
            return None

        inner_html = match.group(1)
        return {
            'inner_html': inner_html,
            'text': self.strip_tags(inner_html),
            'markup': match.group(0),
        }

    def strip_tags(self, html: str) -> str:
        """Extract visible text for simple validation."""
        if not html:
            return ''
        text = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
        text = re.sub(r'</(p|div|li|h[1-6])>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'<[^>]+>', '', text)
        return re.sub(r'\s+', ' ', text).strip()

    def normalize_html(self, html: str) -> str:
        """Normalize markup for safe equality checks."""
        if not html:
            return ''
        return re.sub(r'\s+', ' ', html).strip()

    def remove_annotation_wrappers(self, html: str, attr_name: str) -> str:
        """Remove annotation spans while keeping their inner content."""
        if not html:
            return ''

        pattern = re.compile(
            rf'<span\b(?=[^>]*\b{re.escape(attr_name)}=["\'][^"\']+["\'])[^>]*>(.*?)</span>',
            re.IGNORECASE | re.DOTALL
        )

        previous = None
        current = html
        while previous != current:
            previous = current
            current = pattern.sub(lambda match: match.group(1), current)

        return current

    def unwrap_span(self, html: str, attr_name: str, attr_value: str) -> str:
        """Remove an annotation span while keeping the selected text inside it."""
        if not html:
            return ''

        pattern = re.compile(
            rf'<span\b(?=[^>]*\b{re.escape(attr_name)}=["\']{re.escape(str(attr_value))}["\'])[^>]*>(.*?)</span>',
            re.IGNORECASE | re.DOTALL
        )
        return pattern.sub(lambda match: match.group(1), html, count=1)

    def validate_locks(self, html: str, locks) -> tuple[bool, str | None]:
        """Ensure every stored lock still exists unchanged in new content."""
        for lock in locks:
            span = self.find_span(html, self.LOCK_ATTR, lock.lock_id)
            if not span:
                return False, 'Locked text cannot be removed or edited.'

            current_locked_html = self.remove_annotation_wrappers(
                span['inner_html'],
                self.COMMENT_ATTR
            )
            stored_locked_html = self.remove_annotation_wrappers(
                lock.selected_html,
                self.COMMENT_ATTR
            )

            if self.normalize_html(current_locked_html) != self.normalize_html(stored_locked_html):
                return False, 'Locked text cannot be edited.'

        return True, None
