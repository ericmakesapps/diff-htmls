import {Action, BlockExpression} from './types';
import Match from './Match';
import MatchFinder from './MatchFinder';
import Operation from './Operation';
import MatchOptions from './MatchOptions';
import WordSplitter from './WordSplitter';
import * as Utils from './Utils';

// This value defines balance between speed and memory utilization. The higher it is the faster it works and more memory consumes.
const MatchGranuarityMaximum = 4;

const specialCaseClosingTags = new Map([
    ['</strong>', 0],
    ['</em>', 0],
    ['</b>', 0],
    ['</i>', 0],
    ['</big>', 0],
    ['</small>', 0],
    ['</u>', 0],
    ['</sub>', 0],
    ['</strike>', 0],
    ['</s>', 0],
    ['</dfn>', 0],
]);

const specialCaseOpeningTagRegex =
    /<((strong)|(b)|(i)|(dfn)|(em)|(big)|(small)|(u)|(sub)|(sup)|(strike)|(s))[\>\s]+/gi;

type FindMathProps = {
    startInOld: number;
    endInOld: number;
    startInNew: number;
    endInNew: number;
};

class HtmlDiff {
    private content: string[];
    private newText: string;
    private oldText: string;

    private specialTagDiffStack: string[];
    private newWords: string[];
    private oldWords: string[];
    private orinalWordsInNew: Map<number, string>;
    private orinalWordsInOld: Map<number, string>;

    private matchGranularity: number;
    private blockExpressions: BlockExpression[];

    private repeatingWordsAccuracy: number;
    private ignoreWhiteSpaceDifferences: boolean;
    private orphanMatchThreshold: number;

    constructor(oldText: string, newText: string) {
        this.content = [];
        this.newText = newText;
        this.oldText = oldText;

        this.specialTagDiffStack = [];
        this.newWords = [];
        this.orinalWordsInNew = new Map();
        this.oldWords = [];
        this.orinalWordsInOld = new Map();
        this.matchGranularity = 0;
        this.blockExpressions = [];

        this.repeatingWordsAccuracy = 1.0;
        this.ignoreWhiteSpaceDifferences = false;
        this.orphanMatchThreshold = 0.0;

        this.addBlockExpression = this.addBlockExpression.bind(this);
    }

    diff() {
        if (this.oldText === this.newText) {
            return this.newText;
        }

        this.splitInputsIntoWords();

        this.matchGranularity = Math.min(
            MatchGranuarityMaximum,
            this.oldWords.length,
            this.newWords.length
        );
        let operations = this.operations();

        // set original words
        this.orinalWordsInOld.forEach((value, key) => {
            this.oldWords[key] = value;
        });

        this.orinalWordsInNew.forEach((value, key) => {
            this.newWords[key] = value;
        });

        for (let item of operations) {
            this.performOperation(item);
        }

        return this.content.join('');
    }

    addBlockExpression(exp: BlockExpression) {
        this.blockExpressions.push(exp);
    }

    splitInputsIntoWords() {
        const words = WordSplitter.convertHtmlToListOfWords(
            this.oldText,
            this.blockExpressions
        );
        words.forEach((el, idx) => {
            el[1] && this.orinalWordsInOld.set(idx, el[1]);
        });
        this.oldWords = words.map(el => el[0]);

        //free memory, allow it for GC
        this.oldText = '';

        const newWords = WordSplitter.convertHtmlToListOfWords(
            this.newText,
            this.blockExpressions
        );

        newWords.forEach(
            (el, idx) => el[1] && this.orinalWordsInNew.set(idx, el[1])
        );
        this.newWords = newWords.map(el => el[0]);

        //free memory, allow it for GC
        this.newText = '';
    }

    performOperation(opp: Operation) {
        switch (opp.action) {
            case Action.equal:
                this.processEqualOperation(opp);
                break;
            case Action.delete:
                this.processDeleteOperation(opp, 'diffdel');
                break;
            case Action.insert:
                this.processInsertOperation(opp, 'diffins');
                break;
            case Action.none:
                break;
            case Action.replace:
                this.processReplaceOperation(opp);
                break;
        }
    }

    processReplaceOperation(opp: Operation) {
        this.processDeleteOperation(opp, 'diffmod');
        this.processInsertOperation(opp, 'diffmod');
    }

    processInsertOperation(opp: Operation, cssClass: string) {
        let text = this.newWords.filter(
            (s, pos) => pos >= opp.startInNew && pos < opp.endInNew
        );
        this.insertTag('ins', cssClass, text);
    }

    processDeleteOperation(opp: Operation, cssClass: string) {
        let text = this.oldWords.filter(
            (s, pos) => pos >= opp.startInOld && pos < opp.endInOld
        );
        this.insertTag('del', cssClass, text);
    }

    processEqualOperation(opp: Operation) {
        let result = this.newWords.filter(
            (s, pos) => pos >= opp.startInNew && pos < opp.endInNew
        );
        this.content.push(result.join(''));
    }

    insertTag(tag: string, cssClass: string, content: string[]) {
        let length, nonTags, position, rendering, tags;
        rendering = '';
        position = 0;
        length = content.length;
        while (true) {
            if (position >= length) {
                break;
            }
            nonTags = this.consecutiveWhere(
                position,
                content,
                (x: string) => !Utils.isTag(x)
            );
            position += nonTags.length;
            if (nonTags.length !== 0) {
                rendering += `<${tag} class="${cssClass}">${nonTags.join(
                    ''
                )}</${tag}>`;
            }
            if (position >= length) {
                break;
            }
            tags = this.consecutiveWhere(position, content, Utils.isTag);
            position += tags.length;
            rendering += tags.join('');
        }

        this.content.push(rendering);
    }

    consecutiveWhere(
        start: number,
        content: string[],
        predicate: (value: string) => boolean
    ) {
        let answer, i, index, lastMatchingIndex, len, token;
        content = content.slice(start, +content.length + 1 || 9e9);
        lastMatchingIndex = void 0;
        for (index = i = 0, len = content.length; i < len; index = ++i) {
            token = content[index];
            answer = predicate(token);
            if (answer === true) {
                lastMatchingIndex = index;
            }
            if (answer === false) {
                break;
            }
        }
        if (lastMatchingIndex != null) {
            return content.slice(0, +lastMatchingIndex + 1 || 9e9);
        }
        return [];
    }

    operations() {
        let positionInOld = 0;
        let positionInNew = 0;
        let operations: Operation[] = [];

        let matches = this.matchingBlocks();
        matches.push(new Match(this.oldWords.length, this.newWords.length, 0));

        let matchesWithoutOrphans = this.removeOrphans(matches);

        for (let match of matchesWithoutOrphans) {
            let matchStartsAtCurrentPositionInOld =
                positionInOld === match.startInOld;
            let matchStartsAtCurrentPositionInNew =
                positionInNew === match.startInNew;

            let action;

            if (
                !matchStartsAtCurrentPositionInOld &&
                !matchStartsAtCurrentPositionInNew
            ) {
                action = Action.replace;
            } else if (
                matchStartsAtCurrentPositionInOld &&
                !matchStartsAtCurrentPositionInNew
            ) {
                action = Action.insert;
            } else if (!matchStartsAtCurrentPositionInOld) {
                action = Action.delete;
            } else {
                action = Action.none;
            }

            if (action !== Action.none) {
                operations.push(
                    new Operation({
                        action,
                        startInOld: positionInOld,
                        endInOld: match.startInOld,
                        startInNew: positionInNew,
                        endInNew: match.startInNew,
                    })
                );
            }

            if (match.size !== 0) {
                operations.push(
                    new Operation({
                        action: Action.equal,
                        startInOld: match.startInOld,
                        endInOld: match.endInOld,
                        startInNew: match.startInNew,
                        endInNew: match.endInNew,
                    })
                );
            }

            positionInOld = match.endInOld;
            positionInNew = match.endInNew;
        }

        return operations;
    }

    *removeOrphans(matches: Match[]) {
        let prev = null! as Match;
        let curr = null! as Match;

        for (let next of matches) {
            if (curr === null) {
                prev = new Match(0, 0, 0);
                curr = next;
                continue;
            }

            if (
                (prev?.endInOld === curr.startInOld &&
                    prev.endInNew === curr.startInNew) ||
                (curr.endInOld === next.startInOld &&
                    curr.endInNew === next.startInNew)
            ) {
                yield curr;
                curr = next;
                continue;
            }

            let sumLength = (t: number, n: string) => t + n.length;

            let oldDistanceInChars = this.oldWords
                .slice(prev?.endInOld, next.startInOld)
                .reduce(sumLength, 0);
            let newDistanceInChars = this.newWords
                .slice(prev?.endInNew, next.startInNew)
                .reduce(sumLength, 0);
            let currMatchLengthInChars = this.newWords
                .slice(curr.startInNew, curr.endInNew)
                .reduce(sumLength, 0);
            if (
                currMatchLengthInChars >
                Math.max(oldDistanceInChars, newDistanceInChars) *
                    this.orphanMatchThreshold
            ) {
                yield curr;
            }

            prev = curr;
            curr = next;
        }

        yield curr;
    }

    matchingBlocks() {
        let matchingBlocks = [] as Match[];
        this.findMatchingBlocks({
            startInOld: 0,
            endInOld: this.oldWords.length,
            startInNew: 0,
            endInNew: this.newWords.length,
            matchingBlocks,
        });
        return matchingBlocks;
    }

    findMatchingBlocks({
        startInOld,
        endInOld,
        startInNew,
        endInNew,
        matchingBlocks,
    }: FindMathProps & {matchingBlocks: Match[]}) {
        let match = this.findMatch({
            startInOld,
            endInOld,
            startInNew,
            endInNew,
        });

        if (match !== null) {
            if (
                startInOld < match.startInOld &&
                startInNew < match.startInNew
            ) {
                this.findMatchingBlocks({
                    startInOld,
                    endInOld: match.startInOld,
                    startInNew,
                    endInNew: match.startInNew,
                    matchingBlocks,
                });
            }

            matchingBlocks.push(match);

            if (match.endInOld < endInOld && match.endInNew < endInNew) {
                this.findMatchingBlocks({
                    startInOld: match.endInOld,
                    endInOld,
                    startInNew: match.endInNew,
                    endInNew,
                    matchingBlocks,
                });
            }
        }
    }

    findMatch({startInOld, endInOld, startInNew, endInNew}: FindMathProps) {
        for (let i = this.matchGranularity; i > 0; i--) {
            let options = MatchOptions;
            options.blockSize = i;
            options.repeatingWordsAccuracy = this.repeatingWordsAccuracy;
            options.ignoreWhitespaceDifferences =
                this.ignoreWhiteSpaceDifferences;

            let finder = new MatchFinder({
                oldWords: this.oldWords,
                newWords: this.newWords,
                startInOld,
                endInOld,
                startInNew,
                endInNew,
                options,
            });
            let match = finder.findMatch();
            if (match !== null) {
                return match;
            }
        }

        return null;
    }
}

export default HtmlDiff;
