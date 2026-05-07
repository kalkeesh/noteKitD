from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from config import settings


logger = logging.getLogger(__name__)


def _send_email_sync(to_email: str, subject: str, body: str) -> bool:
    if not settings.email_enabled:
        logger.info("Skipping email delivery because email sending is disabled.")
        return False

    if not settings.email_user or not settings.email_pass:
        logger.warning("Skipping email delivery because SMTP credentials are not configured.")
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.email_user
    msg["To"] = to_email
    msg.set_content(body)

    with smtplib.SMTP_SSL(
        settings.smtp_host,
        settings.smtp_port,
        timeout=settings.smtp_timeout_seconds,
    ) as server:
        server.login(settings.email_user, settings.email_pass)
        server.send_message(msg)
    return True


async def send_email(to_email: str, subject: str, body: str) -> bool:
    try:
        return await asyncio.to_thread(_send_email_sync, to_email, subject, body)
    except smtplib.SMTPAuthenticationError:
        logger.warning("SMTP authentication failed while sending mail to %s.", to_email)
        return False
    except OSError as exc:
        logger.warning("Email delivery skipped for %s because SMTP is unreachable: %s", to_email, exc)
        return False
    except smtplib.SMTPException as exc:
        logger.warning("Email delivery failed for %s due to an SMTP error: %s", to_email, exc)
        return False
    except Exception as exc:
        logger.warning("Email delivery failed for %s: %s", to_email, exc)
        return False
