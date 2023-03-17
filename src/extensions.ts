declare global {
    interface Array<T> {
        /**
         * Sorts the array by the provided property and returns a new sorted array.
         * Default sorting is ASC. You can apply DESC sorting by using the optional parameter "order = 'desc'"
         */
        sortBy<K>(
            keyFunction: (t: T) => K,
            order?: string
        ): T[];
    }
}

if (!Array.prototype.sortBy) {
    Array.prototype.sortBy = function <T, K>(
        keyFunction: (t: T) => K,
        order?: string
    ): T[] {
        if (this.length === 0) {
            return [];
        }

        // determine sort order (asc or desc / asc is default)
        let asc = true;
        if (order === "desc") {
            asc = false;
        }

        const arrayClone = Array.from(this);
        const firstSortProperty = keyFunction(arrayClone[0]);

        if (typeof firstSortProperty === "string") {
            // string in-place sort
            arrayClone.sort((a, b) => {
                if (asc) {
                    return ("" + (keyFunction(a) as string)).localeCompare(keyFunction(b) as string);
                }

                return ("" + (keyFunction(b) as string)).localeCompare(keyFunction(a) as string);
            });

        } else if (typeof firstSortProperty === "number") {
            // number in-place sort
            if (asc) {
                arrayClone.sort((a, b) => Number(keyFunction(a)) - Number(keyFunction(b)));
            } else {
                arrayClone.sort((a, b) => Number(keyFunction(b)) - Number(keyFunction(a)));
            }

        } else {
            throw new Error("sortBy is not implemented for that type!");
        }

        return arrayClone;
    };
}

export { };
