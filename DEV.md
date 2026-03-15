DEV.md

npm run dev generate "A futuristic robot in a garden with a pizza"

npm run dev generate "A mischevious raccoon cooking renndang beef (indonesian recipe), closup, realistic artsy photo, lifestyle shot of cooking raccoon, raccoon is cute, adding lemongrass (chopped) and grilled coconut, we can see ingredients in background" --quality low --size '1536x1024' --debug true

npm run dev generate "A mischevious raccoon cooking renndang beef (indonesian recipe), closup, realistic artsy photo, lifestyle shot of cooking raccoon, raccoon is cute, adding lemongrass (chopped) and grilled coconut, we can see ingredients in background" --quality low --size '1536x1024' --debug true

npm run dev generate --debug --quality low --size '1536x1024' -n 2 "A mischevious raccoon cooking renndang beef (indonesian recipe), closup, realistic artsy photo, lifestyle shot of cooking raccoon, raccoon is cute, adding lemongrass (chopped) and grilled coconut, we can see ingredients in background"

npm run dev generate --prompt "A mischevious raccoon cooking renndang beef (indonesian recipe), closup, realistic artsy photo, lifestyle shot of cooking raccoon, raccoon is cute, adding lemongrass (chopped) and grilled coconut, we can see ingredients in background" --debug --quality low --size '1536x1024' --n 2

npm run dev -- generate
--prompt "A mischevious
raccoon cooking renndang
beef (indonesian recipe),
closup, realistic artsy
photo, lifestyle shot of
cooking raccoon, raccoon
is cute, adding lemongrass
(chopped) and grilled
coconut, we can see
ingredients in background"
--debug --quality low
--size 1536x1024 --number
2

npm run dev -- generate --prompt "A mischievous raccoon cooking rendang beef (indonesian recipe), closeup, realistic artsy disorted stylish magazine photo, shot of cooking raccoon, raccoon is cute, adding lemongrass (chopped) and grilled coconut, we can see ingredients in background" --debug --quality low --size 1536x1024 --number 2

npx ai-image generate --prompt "A mischievous raccoon cooking dan dan noodles, realistic artsy disorted stylish magazine photo, raccoon is cute, adding we can see ingredients in background, crazy composition, arsy rendering and lens effect" --debug --quality high --size 1536x1024 --number 2

# debug MCP

npx @modelcontextprotocol/inspector node src/mcp.js

npx ai-image run mcp

npx ai-image node src/mcp.mjs
