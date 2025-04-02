﻿import { BlockExpression, Mode } from "./types"
import * as Utils from "./Utils"

type BlockLocation = {
	wordBoundaries: {
		starts: number
		ends: number
	}
	targetBoundaries?: {
		starts: number
		ends: number
	}
}

type Word = string[]

class WordSplitter {
	private static state = {
		mode: Mode.character,
		currentWord: [] as string[],
		words: [] as Word[]
	}

	private static blockLocations: BlockLocation[]

	private static prepare() {
		this.state = {
			mode: Mode.character,
			currentWord: [],
			words: []
		}
		this.blockLocations = []
	}

	public static convertHtmlToListOfWords(
		text: string,
		blockExpressions: BlockExpression[] = []
	) {
		this.prepare()
		this.findBlocks(text, blockExpressions)

		const isBlockCheckRequired = !!this.blockLocations.length
		let isGrouping = false
		let groupingUntil = -1
		let blockLocation: BlockLocation | undefined

		for (let idx = 0; idx < text.length; idx++) {
			var character = text[idx]

			// Don't bother executing block checks if we don't have any blocks to check for!
			if (isBlockCheckRequired) {
				// Check if we have completed grouping a text sequence/block
				if (groupingUntil === idx) {
					groupingUntil = -1
					isGrouping = false

					this.state.currentWord.push(character)
					const originalWord = this.state.currentWord.join("")
					if (blockLocation?.targetBoundaries) {
						const newWord = originalWord.slice(
							blockLocation?.targetBoundaries.starts,
							blockLocation?.targetBoundaries.ends
						)
						this.state.words.push([newWord, originalWord])
					} else {
						this.state.words.push([originalWord])
					}

					this.state.currentWord = []
					this.state.mode = Mode.character
					blockLocation = undefined
					continue
				}

				// Check if we need to group the next text sequence/block;
				let newBlockLocation = this.blockLocations.find(
					(el) => el.wordBoundaries.starts === idx
				)

				if (newBlockLocation) {
					blockLocation = newBlockLocation
					if (this.state.currentWord.length !== 0) {
						this.state.words.push([this.state.currentWord.join("")])
						this.state.currentWord = []
					}
					isGrouping = true
					groupingUntil = blockLocation.wordBoundaries.ends
				}

				// if we are grouping, then we don't care about what type of character we have, it's going to be treated as a word
				if (isGrouping) {
					this.state.currentWord.push(character)
					this.state.mode = Mode.character
					continue
				}
			}

			switch (this.state.mode) {
				case Mode.character:
					if (Utils.isStartOfTag(character)) {
						this.addClearWordSwitchMode("<", Mode.tag)
					} else if (Utils.isStartOfEntity(character)) {
						this.addClearWordSwitchMode(character, Mode.entity)
					} else if (Utils.isWhiteSpace(character)) {
						this.addClearWordSwitchMode(character, Mode.whitespace)
					} else if (Utils.isNumber(character)) {
						this.addClearWordSwitchMode(character, Mode.number)
					} else if (
						Utils.isWord(character) &&
						(this.state.currentWord.length === 0 ||
							Utils.isWord(this.state.currentWord[this.state.currentWord.length - 1]))
					) {
						this.state.currentWord.push(character)
					} else {
						this.addClearWordSwitchMode(character, Mode.character)
					}

					break

				case Mode.tag:
					if (Utils.isEndOfTag(character)) {
						this.state.currentWord.push(character)
						this.state.words.push([this.state.currentWord.join("")])

						this.state.currentWord = []
						this.state.mode = Mode.character
					} else {
						this.state.currentWord.push(character)
					}

					break

				case Mode.number:
					this.state.words.push([this.state.currentWord.join("")])
					this.state.currentWord = []

					if (Utils.isStartOfTag(character)) {
						this.addClearWordSwitchMode(character, Mode.tag)
					} else if (Utils.isStartOfEntity(character)) {
						this.addClearWordSwitchMode(character, Mode.entity)
					} else if (Utils.isNumber(character)) {
						this.addClearWordSwitchMode(character, Mode.number)
					} else if (Utils.isWhiteSpace(character)) {
						this.state.currentWord.push(character)
					} else {
						this.addClearWordSwitchMode(character, Mode.character)
					}

					break

				case Mode.whitespace:
					if (Utils.isStartOfTag(character)) {
						this.addClearWordSwitchMode(character, Mode.tag)
					} else if (Utils.isStartOfEntity(character)) {
						this.addClearWordSwitchMode(character, Mode.entity)
					} else if (Utils.isNumber(character)) {
						this.addClearWordSwitchMode(character, Mode.number)
					} else if (Utils.isWhiteSpace(character)) {
						this.state.currentWord.push(character)
					} else {
						this.addClearWordSwitchMode(character, Mode.character)
					}

					break

				case Mode.entity:
					if (Utils.isStartOfTag(character)) {
						this.addClearWordSwitchMode(character, Mode.tag)
					} else if (Utils.isNumber(character)) {
						this.addClearWordSwitchMode(character, Mode.number)
					} else if (Utils.isWhiteSpace(character)) {
						this.addClearWordSwitchMode(character, Mode.whitespace)
					} else if (Utils.isEndOfEntity(character)) {
						let switchToNextMode = true
						if (this.state.currentWord.length !== 0) {
							this.state.currentWord.push(character)
							this.state.words.push([this.state.currentWord.join("")])
						}

						if (switchToNextMode) {
							this.state.currentWord = []
							this.state.mode = Mode.character
						}
					} else if (Utils.isWord(character)) {
						this.state.currentWord.push(character)
					} else {
						this.addClearWordSwitchMode(character, Mode.character)
					}

					break
			}
		}

		if (this.state.currentWord.length !== 0) {
			this.state.words.push([this.state.currentWord.join("")])
		}

		return this.state.words
	}

	private static addClearWordSwitchMode(character: string, mode: Mode) {
		if (this.state.currentWord.length !== 0) {
			this.state.words.push([this.state.currentWord.join("")])
		}

		this.state.currentWord = [character]
		this.state.mode = mode
	}

	private static findBlocks(text: string, blockExpressions: BlockExpression[]) {
		blockExpressions.forEach((exp) => {
			const matches = text.matchAll(exp.exp)

			for (let match of matches) {
				if (match.index !== undefined) {
					if (
						this.blockLocations.find(
							(el) =>
								el.wordBoundaries.starts <= (match.index || 0) &&
								(match.index || 0) <= el.wordBoundaries.ends
						)
					) {
						continue
					}

					const target = exp.compareBy && [...match[0].matchAll(exp.compareBy)][0]

					if (target && target.index !== undefined) {
						this.blockLocations.push({
							wordBoundaries: {
								starts: match.index,
								ends: match.index + match[0].length - 1
							},
							targetBoundaries: {
								starts: target.index,
								ends: target.index + target[0].length
							}
						})
					} else {
						this.blockLocations.push({
							wordBoundaries: {
								starts: match.index,
								ends: match.index! + match[0].length - 1
							}
						})
					}
				}
			}
		})
	}
}

export default WordSplitter
