import HtmlDiff from './Diff';

type Options = {
    blocksExpression?: RegExp[];
};

const diff = (
    oldText: string,
    newText: string,
    {blocksExpression}: Options = {}
) => {
    const finder = new HtmlDiff(oldText, newText);
    if (blocksExpression) {
        blocksExpression.forEach(finder.addBlockExpression);
    }
    return finder.diff();
};

export default diff;
