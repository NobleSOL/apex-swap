# crypto-rand-js

# Installation
```shell
npm install @safeheron/crypto-rand
```
Import the library in code:
```javascript
import {Rand, Prime} from "@safeheron/crypto-rand"
```

# Config Your Random Function

If you don't set a custom function, the library will use the random function of built-in library of NodeJS default.
```javascript
Rand.config_randomBytesImp(
    function (byteSize) {
        const crypto = require("crypto")
        return crypto.randomBytes(byteSize);
    }
);

Rand.config_randomPrimeImp(
    async function (byteSize: number): Promise<BN> {
        while (true) {
            let r = await Rand.randomBN(byteSize)
            if (Prime.isProbablyPrime(r)) {
                return r
            }
        }
    },
);

Rand.config_randomSafePrimeImp(
    async function (byteSize: number): Promise<BN> {
        throw "no implementation for randomSafePrime"
    },
);
```

# Examples

- Get a random array of "n" bytes.
```javascript
let r = await randomBytes(n)
```

- Get a random BN between 0 and 2^n(not included).
```javascript
let r = await randomBytes(n)
```

- Get a random BN between 2^(n-1) and 2^n(not included).
```javascript
let r = await randomBNStrict(n)
```

- Get a random prime between 0 and 2^n(not included).
```javascript
let r = await randomPrime(n)
```

- Get a random prime between 2^(n-1) and 2^n(not included).
```javascript
let r = await randomPrimeStrict(n)
```

- Get a random prime between 0 and 2^256(not included).
```javascript
let r = await randomPrime256Bit(n)
```

- Get a random prime between 2^255 and 2^256(not included).
```javascript
let r = await randomPrimeStrict256Bit(n)
```

- Get a random BN less than 'n'
```javascript
let r = await randomBNLt(n)
```

- (Deprecated)Get a random BN that is less than 'n' and is co-prime with 'n'.
```javascript
let r = await randomBNLtGCD(n)
```

- Get a random BN that is less than 'n' and is co-prime with 'n'.
```javascript
let r = await randomBNLtCoPrime(n)
```
