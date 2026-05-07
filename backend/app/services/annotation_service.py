"""Helpers for comment anchors and locked text spans stored in document HTML."""
import re


class AnnotationService:
    """Validate and inspect comment and lock span markup."""

    COMMENT_ATTR = 'data-comment-id'
    LOCK_ATTR = 'data-lock-id'

    def find_span(self, html: str, attr_name: str, attr_value: str):
        """Return the span markup carrying the requested data attribute."""
        if not html:
            return None

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

    def validate_locks(self, html: str, locks) -> tuple[bool, str | None]:
        """Ensure every stored lock still exists unchanged in new content."""
        for lock in locks:
            span = self.find_span(html, self.LOCK_ATTR, lock.lock_id)
            if not span:
                return False, 'Locked text cannot be removed or edited.'

            if self.normalize_html(span['inner_html']) != self.normalize_html(lock.selected_html):
                return False, 'Locked text cannot be edited.'

        return True, None
