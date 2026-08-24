/**
 * GitLab's own mark, on the button that hands the reader over to GitLab.
 *
 * Decorative: the button says where it goes in words, so naming the graphic
 * would only repeat it. It inherits the button's text colour, which is what
 * keeps it legible in either colour scheme.
 */
export function GitLabMark() {
  return (
    <svg aria-hidden className="size-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M22.65 14.39 12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 5.12 2a.43.43 0 0 1 .58.28l2.44 7.49h8.72l2.44-7.49a.42.42 0 0 1 .41-.29.43.43 0 0 1 .58.29l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.94Z" />
    </svg>
  )
}
