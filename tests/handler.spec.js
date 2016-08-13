'use strict';

var expect = require('chai').expect,
    handler = require(__dirname + '/../lib/handler.js'),
    script,
    phase,
    result,
    expected;

describe('`serverless-artillery` Handler Tests', function() {
    before(() => {
        console.log('Running `serverless-artillery` Handler Tests');
    });
    after(() => {
        console.log('Completed `serverless-artillery` Handler Tests');
    });
    /**
     * SPLIT PHASE BY LENGTH
     */
    describe('The handler splits PHASES that are TOO LONG', function() {
        it(`splitting a constant rate phase of three chunk's length into two parts.`, () => {
            phase = {
                duration: 3 * handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                arrivalRate: 1
            };
            expected = {
                chunk: {
                    duration: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                    arrivalRate: 1
                },
                remainder: {
                    duration: 2 * handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                    arrivalRate: 1
                }
            };
            result = handler.impl.splitPhaseByLength(phase, handler.constants.MAX_CHUNK_DURATION_IN_SECONDS);
            expect(result).to.deep.equal(expected);
        });
        it(`splitting a ramping phase of two chunk's length into two parts.`, () => {
            phase = {
                duration: 3 * handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                arrivalRate: 1,
                rampTo: 4
            };
            expected = {
                chunk: {
                    duration: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                    arrivalRate: 1,
                    rampTo: 2
                },
                remainder: {
                    duration: 2 * handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                    arrivalRate: 2,
                    rampTo: 4
                }
            };
            result = handler.impl.splitPhaseByLength(phase, handler.constants.MAX_CHUNK_DURATION_IN_SECONDS);
            expect(result).to.deep.equal(expected);
        });
        it(`splitting a ramping phase of two chunk's length into two parts, rounding to the nearest integer rate per second.`, () => {
            phase = {
                duration: 2 * handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                arrivalRate: 1,
                rampTo: 2
            };
            expected = {
                chunk: {
                    duration: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                    arrivalRate: 1,
                    rampTo: 2
                },
                remainder: {
                    duration: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                    arrivalRate: 2,
                    rampTo: 2
                }
            };
            result = handler.impl.splitPhaseByLength(phase, handler.constants.MAX_CHUNK_DURATION_IN_SECONDS);
            expect(result).to.deep.equal(expected);
        });
        it(`splitting an arrival count phase of two chunk's length into two parts.`, () => {
            phase = {
                duration: 2 * handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                arrivalCount: 2 * handler.constants.MAX_CHUNK_DURATION_IN_SECONDS
            };
            expected = {
                chunk: {
                    duration: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                    arrivalCount: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS
                },
                remainder: {
                    duration: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                    arrivalCount: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS
                }
            };
            result = handler.impl.splitPhaseByLength(phase, handler.constants.MAX_CHUNK_DURATION_IN_SECONDS);
            expect(result).to.deep.equal(expected);
        });
        it(`splitting a pause phase of two chunk's length into two parts.`, () => {
            phase = {
                pause: 2 * handler.constants.MAX_CHUNK_DURATION_IN_SECONDS
            };
            expected = {
                chunk: {
                    pause: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS
                },
                remainder: {
                    pause: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS
                }
            };
            result = handler.impl.splitPhaseByLength(phase, handler.constants.MAX_CHUNK_DURATION_IN_SECONDS);
            expect(result).to.deep.equal(expected);
        });
    });
    /**
     * SPLIT SCRIPT BY LENGTH
     */
    describe('The handler splits SCRIPTS that are TOO LONG', function() {
        it(`splitting a script where there is a natural phase split at MAX_CHUNK_DURATION between two phases.`, () => {
            script = {
                config: {
                    phases: [
                        {
                            duration: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                            arrivalRate: 1
                        },
                        {
                            duration: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                            arrivalRate: 2
                        }
                    ]
                }
            };
            expected = {
                chunk: {
                    config: {
                        phases: [
                            {
                                duration: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                                arrivalRate: 1
                            }
                        ]
                    }
                },
                remainder: {
                    config: {
                        phases: [
                            {
                                duration: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                                arrivalRate: 2
                            }
                        ]
                    }
                }
            };
            result = handler.impl.splitScriptByLength(script, handler.constants.MAX_CHUNK_DURATION_IN_SECONDS);
            expect(result).to.deep.equal(expected);
        });
        it(`splitting a script where there is a natural phase split at MAX_CHUNK_DURATION between many phases.`, () => {
            script = {
                config: {
                    phases: [
                        {
                            duration: Math.floor(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                            arrivalRate: 1
                        },
                        {
                            duration: Math.ceil(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                            arrivalRate: 1
                        },
                        {
                            duration: Math.floor(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                            arrivalRate: 1
                        },
                        {
                            duration: Math.ceil(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                            arrivalRate: 1
                        },
                        {
                            duration: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                            arrivalRate: 2
                        }
                    ]
                }
            };
            expected = {
                chunk: {
                    config: {
                        phases: [
                            {
                                duration: Math.floor(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                                arrivalRate: 1
                            },
                            {
                                duration: Math.ceil(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                                arrivalRate: 1
                            }
                        ]
                    }
                },
                remainder: {
                    config: {
                        phases: [
                            {
                                duration: Math.floor(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                                arrivalRate: 1
                            },
                            {
                                duration: Math.ceil(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                                arrivalRate: 1
                            },
                            {
                                duration: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS,
                                arrivalRate: 2
                            }
                        ]
                    }
                }
            };
            result = handler.impl.splitScriptByLength(script, handler.constants.MAX_CHUNK_DURATION_IN_SECONDS);
            expect(result).to.deep.equal(expected);
        });
        it(`splitting a script where a phase must be split at MAX_CHUNK_DURATION.`, () => {
            script = {
                config: {
                    phases: [
                        {
                            duration: Math.floor(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.75),
                            arrivalRate: 1
                        },
                        {
                            duration: Math.ceil(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.75),
                            arrivalRate: 1
                        },
                        {
                            duration: Math.floor(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.75),
                            arrivalRate: 1
                        }
                    ]
                }
            };
            expected = {
                chunk: {
                    config: {
                        phases: [
                            {
                                duration: Math.floor(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.75),
                                arrivalRate: 1
                            },
                            {
                                duration: Math.ceil(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.25),
                                arrivalRate: 1
                            }
                        ]
                    }
                },
                remainder: {
                    config: {
                        phases: [
                            {
                                duration: Math.floor(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.5),
                                arrivalRate: 1
                            },
                            {
                                duration: Math.ceil(handler.constants.MAX_CHUNK_DURATION_IN_SECONDS * 0.75),
                                arrivalRate: 1
                            }
                        ]
                    }
                }
            };
            result = handler.impl.splitScriptByLength(script, handler.constants.MAX_CHUNK_DURATION_IN_SECONDS);
            expect(result).to.deep.equal(expected);
        });
    });
    /**
     * SPLIT PHASE BY WIDTH
     */
    describe('The handler splits PHASES that are TOO WIDE (RPS > MAX_RPS)', function() {
        // min >= chunkSize
        it(`splitting a ramp phase that at all times exceeds a rate of MAX_CHUNK_REQUESTS_PER_SECOND into a constant rate and remainder ramp phases.`, () => {
            phase = {
                arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 2,
                rampTo: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 3,
                duration: 1
            };
            expected = {
                chunk: [
                    {
                        arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND,
                        duration: 1
                    }
                ],
                remainder: [
                    {
                        arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND,
                        rampTo: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 2,
                        duration: 1
                    }
                ]
            };
            result = handler.impl.splitPhaseByWidth(phase, handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND);
            expect(result).to.deep.equal(expected);
        });
        // max <= chunkSize
        it(`splitting a ramp phase that at all times is less than MAX_CHUNK_REQUESTS_PER_SECOND into a chunk of the ramp phase and a remainder of a pause phase.`, () => {
            phase = {
                arrivalRate: Math.floor(handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 0.5),
                rampTo: Math.floor(handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 0.75),
                duration: 1
            };
            expected = {
                chunk: [
                    {
                        arrivalRate: Math.floor(handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 0.5),
                        rampTo: Math.floor(handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 0.75),
                        duration: 1
                    }
                ],
                remainder: [
                    {
                        pause: 1
                    }
                ]
            };
            result = handler.impl.splitPhaseByWidth(phase, handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND);
            expect(result).to.deep.equal(expected);
        });
        it(`splitting an ascending ramp phase that starts lower than and ends higher than MAX_CHUNK_REQUESTS_PER_SECOND into a chunk of a ramp phase followed by a constant rate phase and a remainder of a pause phase followed by a ramp phase.`, () => {
            phase = {
                arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 0.5,
                rampTo: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 1.5,
                duration: 2
            };
            expected = {
                chunk: [
                    {
                        arrivalRate: phase.arrivalRate,
                        rampTo: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND,
                        duration: 1
                    },
                    {
                        arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND,
                        duration: 1
                    }
                ],
                remainder: [
                    {
                        pause: 1
                    },
                    {
                        arrivalRate: 1,
                        rampTo: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 1.5 - handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND,
                        duration: 1
                    }
                ]
            };
            result = handler.impl.splitPhaseByWidth(phase, handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND);
            expect(result).to.deep.equal(expected);
        });
        it(`splitting a descending ramp phase that starts lower than and ends higher than MAX_CHUNK_REQUESTS_PER_SECOND into a chunk of a constant rate phase followed by a ramp phase and a remainder of a ramp phase followed by a pause phase.`, () => {
            phase = {
                arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 1.5,
                rampTo: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 0.5,
                duration: 2
            };
            expected = {
                chunk: [
                    {
                        arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND,
                        duration: 1
                    },
                    {
                        arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND,
                        rampTo: phase.rampTo,
                        duration: 1
                    }
                ],
                remainder: [
                    {
                        arrivalRate: phase.arrivalRate - handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND,
                        rampTo: 1,
                        duration: 1
                    },
                    {
                        pause: 1
                    }
                ]
            };
            result = handler.impl.splitPhaseByWidth(phase, handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND);
            expect(result).to.deep.equal(expected);
        });
        it(`splitting an arrivalRate phase of less than a chunk's width into a chunk of the original constant width and a remainder of a pause.`, () => {
            phase = {
                arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 0.75,
                duration: 1
            };
            expected = {
                chunk: [
                    {
                        arrivalRate: phase.arrivalRate,
                        duration: 1
                    }
                ],
                remainder: [
                    {
                        pause: 1
                    }
                ]
            };
            result = handler.impl.splitPhaseByWidth(phase, handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND);
            expect(result).to.deep.equal(expected);
        });
        it(`splitting an arrivalRate phase of two chunk's width into two parts.`, () => {
            phase = {
                arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 2,
                duration: 1
            };
            expected = {
                chunk: [
                    {
                        arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND,
                        duration: 1
                    }
                ],
                remainder: [
                    {
                        arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND,
                        duration: 1
                    }
                ]
            };
            result = handler.impl.splitPhaseByWidth(phase, handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND);
            expect(result).to.deep.equal(expected);
        });
        it(`splitting an arrivalCount phase of two chunk's width into two parts.`, () => {
            phase = {
                arrivalCount: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 2,
                duration: 1
            };
            expected = {
                chunk: [
                    {
                        arrivalCount: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND,
                        duration: 1
                    }
                ],
                remainder: [
                    {
                        arrivalCount: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND,
                        duration: 1
                    }
                ]
            };
            result = handler.impl.splitPhaseByWidth(phase, handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND);
            expect(result).to.deep.equal(expected);
        });
        it(`splitting an arrivalCount phase of less than chunkSize's width into an arrival count and pause phase.`, () => {
            phase = {
                arrivalCount: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 0.75,
                duration: 1
            };
            expected = {
                chunk: [
                    {
                        arrivalCount: phase.arrivalCount,
                        duration: 1
                    }
                ],
                remainder: [
                    {
                        pause: 1
                    }
                ]
            };
            result = handler.impl.splitPhaseByWidth(phase, handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND);
            expect(result).to.deep.equal(expected);
        });
        it(`splitting a pause phase into two pause phases.`, () => {
            phase = {
                pause: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS
            };
            expected = {
                chunk: [
                    { pause: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS }
                ],
                remainder: [
                    { pause: handler.constants.MAX_CHUNK_DURATION_IN_SECONDS }
                ]
            };
            result = handler.impl.splitPhaseByWidth(phase, handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND);
            expect(result).to.deep.equal(expected);
        });
    });
    /**
     * SPLIT SCRIPT BY WIDTH
     */
    describe('The handler splits SCRIPTS that are TOO WIDE', function() {
        it(`splitting a script where there is a single phase that specifies twice MAX_CHUNK_REQUESTS_PER_SECOND load to split.`, () => {
            script = {
                config: {
                    phases: [
                        {
                            duration: 1,
                            arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 2
                        }
                    ]
                }
            };
            expected = {
                chunk: {
                    config: {
                        phases: [
                            {
                                duration: 1,
                                arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND
                            }
                        ]
                    }
                },
                remainder: {
                    config: {
                        phases: [
                            {
                                duration: 1,
                                arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND
                            }
                        ]
                    }
                }
            };
            result = handler.impl.splitScriptByWidth(script, handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND);
            expect(result).to.deep.equal(expected);
        });
        it(`splitting a script where there are two phases that specifies twice MAX_CHUNK_REQUESTS_PER_SECOND load to split.`, () => {
            script = {
                config: {
                    phases: [
                        {
                            duration: 1,
                            arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 2
                        },
                        {
                            duration: 1,
                            arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND * 2
                        }
                    ]
                }
            };
            expected = {
                chunk: {
                    config: {
                        phases: [
                            {
                                duration: 1,
                                arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND
                            },
                            {
                                duration: 1,
                                arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND
                            }
                        ]
                    }
                },
                remainder: {
                    config: {
                        phases: [
                            {
                                duration: 1,
                                arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND
                            },
                            {
                                duration: 1,
                                arrivalRate: handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND
                            }
                        ]
                    }
                }
            };
            result = handler.impl.splitScriptByWidth(script, handler.constants.MAX_CHUNK_REQUESTS_PER_SECOND);
            expect(result).to.deep.equal(expected);
        });
    });
});
