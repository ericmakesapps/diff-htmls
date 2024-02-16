# Diff HTML

This is originally a fork of
[html-diff-ts](https://github.com/ericmakesapps/html-diff-ts), which is a TypeScript port
of [HtmlDiff.NET](https://github.com/Rohland/htmldiff.net) which is itself a C# port of
the Ruby implementation, [HtmlDiff](https://github.com/myobie/htmldiff/).

The purpose of this fork was to fix the handling of overlapping blocks. For example, if
diffing URLs, I want them to not be broken up, but also I want `img` tags to not be broken
up. However, `img`s contain URLs in the href, which throws an error. This fixes that.

## Roadmap

This will also fix the weird word-by-word result that this package gives. It's technically
correct, but a better user experience would be collapsing sequential changes.

## Installation

`npm i diff-htmls`

## Project Description

Comparing two HTML blocks, and returns a meshing of the two that includes `<ins>` and
`<del>` elements. The classes of these elements are `ins.diffins` for new code,
`del.diffdel` for removed code, and `del.diffmod` and `ins.diffmod` for sections of code
that have been changed.

For "special tags" (primarily style tags such as `<em>` and `<strong>`), `ins.mod`
elements are inserted with the new styles.

## API

Options:

-   `blocksExpression` - list of Regular Expressions which will be countes as one block
    (token) instead of dividing it on parts by default mechanism (better see example)
    -   `exp` - Regular Expression for token itself
    -   `compareBy` - Regular Expression for part of the token by which will be comparison
        made

## Usage

### Basic

```typescript
import diff from "diff-htmls"

const oldHtml = "<p>Some <em>old</em> html here</p>"
const newHtml = "<p>Some <b>new</b> html goes here</p>"

const result = diff(oldHtml, newHtml)
```

Result:

```html
<p>
	Some <del><em>old</em></del
	><ins><b>new</b></ins> html here
</p>
```

Visualization:

```diff
Some
- <em>old</em>
+ <b>new</b>
html here
```

### With blocksExpression

The tokenizer works by running the diff on words, but sometimes this isn't ideal. For example, it may look clunky when a date is edited from 12 Jan 2022 to 14 Feb 2022. It might be neater to treat the diff on the entire date rather than the independent tokens.
You can achieve this using AddBlockExpression. Note, the Regex example is not meant to be exhaustive to cover all dates. If text matches the expression, the entire phrase is included as a single token to be compared, and that results in a much neater output.

```typescript
import diff from "diff-htmls"

const oldHtml = "<p>12.11.2022</p>"
const newHtml = "<p>15.12.2022</p>"
const dateRegexp = /\d\d\.\d\d\.\d\d\d\d/gm

const result = (oldHtml, newHtml, { blocksExpression: [{ exp: dateRegexp }] })
```

Result:

```html
<p>
    <p><del>12.11.2022</del> <ins>15.12.2022</ins></p>
</p>
```

Visualization:

```diff
<p>
- <em>12.11.2022</em>
+ <b>15.12.2022</b>
</p>
```

### With blocksExpression and compareBy

No diff

```typescript
import diff from "diff-htmls"

// "src" attr is different but "title" - is the same
const oldHtml = '<img src="./old.png" title="title-1" />'
// "src" attr is different but "title" - is the same
const newHtml = '<img src="./new.png" title="title-1" />'

const result =
	(oldHtml,
	newHtml,
	{
		blocksExpression: [
			{
				// match <img/> tag
				exp: /<img[\w\W]+?\/>/g,
				// compare only by title="" attribute
				compareBy: /title="[\w\W]+?"/g
			}
		]
	})
```

Result:  
Will return the new string without comparison to old one - because title attribute is the
same

```html
<img src="./new.png" title="title-1" />
```

Has diff

```typescript
import diff from "diff-htmls"

// "title" attr is different
const oldHtml = '<img src="./old.png" title="old-title" />'
// "title" attr is different
const newHtml = '<img src="./new.png" title="new-title" />'

const result =
	(oldHtml,
	newHtml,
	{
		blocksExpression: [
			{
				// match <img/> tag
				exp: /<img[\w\W]+?\/>/g,
				// compare only by title="" attribute
				compareBy: /title="[\w\W]+?"/g
			}
		]
	})
```

Result:  
Will return the new string with diff to old one - because title attribute has changed

```html
<del>
	<img src="./old.png" title="old-title" />
</del>
<ins>
	<img src="./new.png" title="new-title" />
</ins>
```

Visualization:

```diff
<p>
- <img src="./old.png" title="old-title" />
+ <img src="./new.png" title="new-title" />
</p>
```
