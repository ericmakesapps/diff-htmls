import Operation from "../Operation"
import { Action } from "../types"

describe("Operation", () => {
	const operation = new Operation({
		action: Action.insert,
		startInNew: 1,
		startInOld: 2,
		endInNew: 3,
		endInOld: 4
	})

	it('set action to "action" field', () => {
		expect(operation.action).toBe(Action.insert)
	})
	it('set startInNew to "startInNew" field', () => {
		expect(operation.startInNew).toBe(1)
	})
	it('set startInOld to "startInOld" field', () => {
		expect(operation.startInOld).toBe(2)
	})
	it('set endInNew to "endInNew" field', () => {
		expect(operation.endInNew).toBe(3)
	})
	it('set endInOld to "endInOld" field', () => {
		expect(operation.endInOld).toBe(4)
	})
})
