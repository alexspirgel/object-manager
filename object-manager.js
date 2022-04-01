module.exports = class ObjectManager {

	static isString(string) {
		return (typeof string === 'string');
	}

	static isObject(object) {
		return (typeof object === 'object' && object !== null);
	}

	static normalizePath(path) {
		if (typeof path === 'string') {
			path = path.split('.');
		}
		if (Array.isArray(path) && path.every(this.isString)) {
			return path;
		}
		else {
			throw new Error(`'path' must be either a string or an array of strings.`);
		}
	}

	static getPathId(path) {
		path = this.normalizePath(path);
		return path.join('.');
	}

	static getObjectProperty(object, path, defaultValue) {
		let result = object;
		path = this.normalizePath(path);
		if (path.length > 0) {
			for (const part of path) {
				if (this.isObject(result)) {
					result = result[part];
				}
				else {
					result = undefined;
					break;
				}
			}
		}
		if (typeof result !== 'undefined') {
			return result;
		}
		else {
			return defaultValue;
		}
	}

	static setObjectProperty(object, path, value) {
		let success = false;
		path = this.normalizePath(path);
		if (path.length > 0) {
			const lastPart = path[path.length - 1];
			for (const part of path) {
				if (this.isObject(object)) {
					if (part === lastPart) {
						object[part] = value;
						success = true;
					}
					else {
						object = object[part];
					}
				}
				else {
					break;
				}
			}
		}
		return success;
	}

	static get eventListenerTypes() {
		return [
			'get',
			'set',
			'change'
		];
	}

	static validateEventListenerType(type) {
		if (!this.eventListenerTypes.includes(type)) {
			throw new Error(`type '${type}' is not a valid type.`);
		}
	}

	constructor(object, validation) {
		this.object = object;
		this.validation = validation;
	}

	get object() {
		return this._object;
	}

	set object(object) {
		if (!this.constructor.isObject(object)) {
			throw new Error(`'object' must be an object.`);
		}
		this._object = object;
	}

	get validation() {
		return this._validation;
	}

	set validation(validation) {
		if (!this.constructor.isObject(validation) && typeof validation !== 'undefined') {
			throw new Error(`'validation' must be an object or undefined.`);
		}
		this._validation = validation;
	}

	validatePropertyValue(path, value) {
		path = this.constructor.normalizePath(path);
		const pathId = this.constructor.getPathId(path);
		if (this.validation && typeof this.validation[pathId] === 'function') {
			this.validation[pathId]({
				value: value,
				path: path,
				pathId: pathId,
				object: this.object
			});
		}
	}

	get(path, defaultValue) {
		path = this.constructor.normalizePath(path);
		const value = this.constructor.getObjectProperty(this.object, path, defaultValue);
		this.dispatchEvent(path, 'get', {
			object: this.object,
			path: path,
			type: 'get',
			value: value
		});
		return value;
	}

	set(path, value) {
		this.validatePropertyValue(path, value);
		path = this.constructor.normalizePath(path);
		const previousValue = this.constructor.getObjectProperty(this.object, path);
		const setSuccess = this.constructor.setObjectProperty(this.object, path, value);
		if (setSuccess) {
			this.dispatchEvent(path, 'set', {
				object: this.object,
				path: path,
				type: 'set',
				value: value,
				previousValue: previousValue
			});
			if (value !== previousValue) {
				this.dispatchEvent(path, 'change', {
					object: this.object,
					path: path,
					type: 'change',
					value: value,
					previousValue: previousValue
				});
			}
		}
		return setSuccess;
	}

	_merge(path = [], merge) {
		if (Array.isArray(merge)) {
			this.set(path, []);
			for (let index = 0; index < merge.length; index++) {
				path.push(index);
				this.set(path, this._merge(path, merge[index]));
				path.splice(-1);
			}
		}
		else if (this.constructor.isObject(merge)) {
			if (!this.constructor.isObject(this.constructor.getObjectProperty(this.object, path))) {
				this.set(path, {});
			}
			for (let property in merge) {
				path.push(property);
				this.set(path, this._merge(path, merge[property]));
				path.splice(-1);
			}
		}
		else if (typeof merge !== 'undefined') {
			this.set(path, merge);
		}
		return this.constructor.getObjectProperty(this.object, path);
	}

	merge(mergeObject) {
		if (!this.constructor.isObject(mergeObject)) {
			throw new Error(`'mergeObject' must be an object.`);
		}
		this._merge([], mergeObject);
	}

	get eventListeners() {
		if (!this.constructor.isObject(this._eventListeners)) {
			this._eventListeners = {};
		}
		return this._eventListeners;
	}

	addEventListener(path, type, callback) {
		const pathId = this.constructor.getPathId(path);
		this.constructor.validateEventListenerType(type);
		if (typeof callback !== 'function') {
			throw new Error(`callback must be a function.`);
		}
		if (!this.eventListeners[pathId]) {
			this.eventListeners[pathId] = [];
		}
		const eventListener = {
			type: type,
			callback: callback
		};
		this.eventListeners[pathId].push(eventListener);
	}

	dispatchEvent(path, type, event) {
		path = this.constructor.normalizePath(path);
		const pathId = this.constructor.getPathId(path);
		this.constructor.validateEventListenerType(type);
		if (Array.isArray(this.eventListeners[pathId])) {
			if (typeof event === 'undefined') {
				event = {
					object: this.object,
					path: path,
					type: type
				};
			}
			for (const eventListener of this.eventListeners[pathId]) {
				if (eventListener.type === type) {
					eventListener.callback(event);
				}
			}
		}
	}

	removeEventListener(path, type, callback) {
		const pathId = this.constructor.getPathId(path);
		if (Array.isArray(this.eventListeners[pathId])) {
			for (let eventListenerIndex = 0; eventListenerIndex < this.eventListeners[pathId].length; eventListenerIndex++) {
				const eventListener = this.eventListeners[pathId][eventListenerIndex];
				if (type === eventListener.type && callback === eventListener.callback) {
					this.eventListeners[pathId].splice(eventListenerIndex, 1);
				}
			}
		}
	}

};