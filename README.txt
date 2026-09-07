CASE TRACKING SYSTEM

Files:
- index.html
- script.js
- style.css
- Code.gs

IMPORTANT:
Column I (redirectUrl) is the only source for the redirect link.
Put the desired link in column I of the corresponding row, for example:
www.farhad.com

The Apps Script normalizes it to:
https://www.farhad.com

The supplied Apps Script URL is already included in script.js.

Sheet columns:
A sessionId
B caseName
C trackingNumber
D caseYear
E caseMonth
F otp
G adminStatus
H waiting
I redirectUrl
J captchaInput
K securityVerified
L createdAt
M updatedAt

For approval, set column G to:
ok

Do not put the link in another column.
