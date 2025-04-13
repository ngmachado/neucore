/**
 * AI extensions for the AlfaFrens client
 * 
 * These extensions are optional and can be used to add AI capabilities
 * to the AlfaFrens client.
 */

import { AlfaFrensAIPost } from "./ai-post";
import { AlfaFrensAIInteraction } from "./ai-interaction";
import { createAlfaFrensActions, registerAlfaFrensActions } from "./actions";
import * as utils from "./utils";

export {
    AlfaFrensAIPost,
    AlfaFrensAIInteraction,
    createAlfaFrensActions,
    registerAlfaFrensActions,
    utils
}; 