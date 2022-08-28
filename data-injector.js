"use strict"

const dataInjector = {
    requestExpression: /\{([0-9]|[a-z]|[A-Z]|_|-|\s|\||\.|\/|\$|\(|\))+\}/g,
    socketExpression: /\{\$([0-9])+\}/g,

    checkForError(expression, errorMessage) {
        if (expression)
            throw new Error(`Data injector error: ${errorMessage}.`)
    },

    format(value, attribute) {
        switch (attribute) {
            case "upper-case":
                return value.toUpperCase()
            case "lower-case":
                return value.toLowerCase()
            case "capitalize":
                const lowerCase = value.toLowerCase()
                return (
                    lowerCase[0].toUpperCase() +
                    lowerCase.substr(1, lowerCase.length - 1)
                )
            case "kebab-case":
                return value.replace(/\s/g, "-")
            case "snake-case":
                return value.replace(/\s/g, "_")
            default:
                return this.checkForError(true, `Unknown format ${attribute}`)
        }
    },

    template(value, attributes, data) {
        const parameters = []

        // Parameters are being built from strings that start with "$("
        // and being pushed to a parameter array until there's ")"
        let paramIndex = 0
        let builder = false
        for (const attr of attributes) {
            if (builder) {
                if (attr.match(/\)/g)) {
                    // Parameter with formats end
                    parameters[paramIndex].push(
                        attr.substr(0, attr.length - 1).trim()
                    )
                    paramIndex++
                    builder = false
                } else {
                    // Parameters with formats middle
                    parameters[paramIndex].push(attr)
                }
            } else if (attr[0] === "$" && attr[1] === "(") {
                // Parameter with formats start
                builder = true
                parameters[paramIndex] = []
                parameters[paramIndex].push(
                    attr.substr(2, attr.length - 1).trim()
                )
            } else if (attr[0] === "$" && attr[1] !== "(") {
                // Parameter without formats
                parameters[paramIndex] = []
                parameters[paramIndex].push(
                    attr.substr(1, attr.length - 1).trim()
                )
                paramIndex++
            } else {
                this.checkForError(
                    true,
                    "Only parameters are accepted for a template"
                )
            }
        }

        const sockets = value.match(this.socketExpression)

        const indexes = sockets
            .map(socket => socket.replace(/\{|\}|\$/g, "",))
            .map(index => Number.parseInt(index))

        const sortedIndexes = indexes.sort()
        let filledValue = value

        this.checkForError(
            sortedIndexes.length != parameters.length,
            "There has to be the same amount of parameters and sockets"
        );

        for (let i = 0; i < indexes.length; i++) {
            const socketReplace = "{$" + sortedIndexes[i] + "}"

            const [key, ...formats] = parameters[i];
            let value = data[key] ? data[key] : key

            if (formats) {
                for (const format of formats) {
                    value = this.format(value, format)
                }
            }

            filledValue = filledValue.replace(
                socketReplace,
                value
            )
        }
        return filledValue
    },

    eval(string, data) {
        const calls = string.match(this.requestExpression);
        if (!calls) return string;

        data = data ? data : {} // Is there data object given ?

        const newValues = [];

        // Reading
        for (const call of calls) {
            const [key, ...attributes] = call
                .substr(1, call.length - 2) // Stripping the brackets
                .split("|")                 // Separating key and attributes
                .map(value => value.trim()) // Trimming trailing spaces

            let value = data[key] ? data[key] : key

            if (value.match(this.socketExpression)) {
                value = this.template(value, attributes, data)
            } else if (attributes) {
                for (const attr of attributes) {
                    value = this.format(value, attr);
                }
            }

            newValues.push(value)
        }

        // Replacing
        for (let i = 0; i < calls.length; i++) {
            string = string.replace(calls[i], newValues[i])
        }

        // Checking if there's still stuff to evaluate
        if (string.match(this.requestExpression))
            string = this.eval(string, data)

        return string
    },

    run(data) {
        const injectorRequests = document.querySelectorAll("[data-injector]")

        for (const req of injectorRequests)
            req.innerHTML = this.eval(req.innerHTML, data)
    },
};
