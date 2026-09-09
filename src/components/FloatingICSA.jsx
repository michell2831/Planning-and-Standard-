import React, { useState, useEffect, useRef } from "react";
import {
    Box,
    Paper,
    Typography,
    Button,
    IconButton,
    InputBase,
    Chip,
    Badge,
    Avatar,
    Zoom,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import StarIcon from "@mui/icons-material/Star";
import iscaProfile from "../logo/isca profile.png";
const ICSA_API_URL = import.meta.env.VITE_ISCA_API_URL || import.meta.env.VITE_ICSA_API_URL || "https://icsa-api.onrender.com";
const ICSA_API = ICSA_API_URL.replace(/\/$/, "");

const SUGGESTED_QUESTIONS = [
    {
        category: "HEALTH SERVICES",
        question: "What do I need for a medical certificate?",
    },
    {
        category: "REGISTRAR OFFICE",
        question: "How do I get a new student ID?",
    },
    {
        category: "ACADEMIC SERVICES",
        question: "How do I apply for cross-enrollment?",
    },
    {
        category: "OSAS GUIDANCE",
        question: "What do I need for a counseling appointment?",
    },
];

// Helper to format assistant markdown-like answers
function FormattedText({ content }) {
    if (!content) return null;
    const lines = content.split("\n");

    return (
        <Box sx={{ fontSize: "0.84rem", lineHeight: 1.55 }}>
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return <Box key={idx} sx={{ height: 4 }} />;

                if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                    return (
                        <Box key={idx} sx={{ display: "flex", gap: 1, my: 0.3, alignItems: "flex-start" }}>
                            <Box component="span" sx={{ color: "#D97706", fontWeight: "bold" }}>•</Box>
                            <Box component="span">{renderInlineStyles(trimmed.slice(2))}</Box>
                        </Box>
                    );
                }

                const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
                if (numMatch) {
                    return (
                        <Box key={idx} sx={{ display: "flex", gap: 1, my: 0.3, alignItems: "flex-start" }}>
                            <Box component="span" sx={{ color: "#800000", fontWeight: 700, minWidth: 16 }}>
                                {numMatch[1]}.
                            </Box>
                            <Box component="span">{renderInlineStyles(numMatch[2])}</Box>
                        </Box>
                    );
                }

                return (
                    <Typography key={idx} variant="body2" sx={{ mb: 0.6, fontSize: "0.84rem" }}>
                        {renderInlineStyles(line)}
                    </Typography>
                );
            })}
        </Box>
    );
}

function renderInlineStyles(text) {
    const parts = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }
        const token = match[0];
        if (token.startsWith("**") && token.endsWith("**")) {
            parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
        } else if (token.startsWith("*") && token.endsWith("*")) {
            parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
        }
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
}

export default function FloatingICSA() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId] = useState(() => "pss-" + Math.random().toString(36).substring(2, 11));

    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isLoading, isOpen]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen]);

    const handleSend = async (textToSend) => {
        const value = (textToSend ?? input).trim();
        if (!value || isLoading) return;

        const userMsg = {
            id: "user-" + Date.now(),
            role: "user",
            content: value,
        };

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput("");
        setIsLoading(true);

        const historyPayload = newMessages
            .filter((m) => !m.isError)
            .map((m) => ({
                role: m.role === "user" ? "user" : "assistant",
                content: m.content,
            }));

        try {
            const res = await fetch(`${ICSA_API}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: value,
                    session_id: sessionId,
                    chat_history: historyPayload.slice(-6),
                }),
            });

            if (!res.ok) throw new Error(`API error ${res.status}`);

            const data = await res.json();
            setMessages((prev) => [
                ...prev,
                {
                    id: "asst-" + Date.now(),
                    role: "assistant",
                    content: data.answer || "I received your request.",
                    matched_service: data.matched_service,
                    office: data.office,
                },
            ]);
        } catch (err) {
            console.error("[ICSA Floating] Error:", err);
            setMessages((prev) => [
                ...prev,
                {
                    id: "err-" + Date.now(),
                    role: "assistant",
                    content: "Sorry, I couldn't connect to the ICSA service. Please try again.",
                    isError: true,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999 }}>
            {/* Floating Trigger FAB */}
            <Badge
                overlap="circular"
                anchorOrigin={{ vertical: "top", horizontal: "right" }}
                variant="dot"
                sx={{
                    "& .MuiBadge-badge": {
                        backgroundColor: "#10B981",
                        boxShadow: "0 0 6px #10B981",
                        border: "2px solid #FFFFFF",
                        width: 13,
                        height: 13,
                        borderRadius: "50%",
                    },
                }}
            >
                <IconButton
                    onClick={() => setIsOpen((prev) => !prev)}
                    sx={{
                        width: 62,
                        height: 62,
                        p: 0,
                        backgroundColor: "#800000",
                        border: "2px solid #D97706",
                        boxShadow: "0 8px 24px rgba(128, 0, 0, 0.4)",
                        transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        "&:hover": {
                            transform: "translateY(-3px) scale(1.06)",
                            backgroundColor: "#660000",
                            boxShadow: "0 12px 28px rgba(128, 0, 0, 0.5)",
                        },
                    }}
                >
                    <Avatar
                        src={iscaProfile}
                        alt="ICSA Agent"
                        sx={{ width: "100%", height: "100%" }}
                    >
                        ICSA
                    </Avatar>
                </IconButton>
            </Badge>

            {/* Chat Modal Window */}
            <Zoom in={isOpen} style={{ transformOrigin: "bottom right" }}>
                <Paper
                    elevation={16}
                    sx={{
                        position: "absolute",
                        bottom: 76,
                        right: 0,
                        width: { xs: "calc(100vw - 32px)", sm: 500 },
                        height: { xs: "calc(100vh - 110px)", sm: 620 },
                        borderRadius: 4,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        border: "1px solid #E2E8F0",
                        bgcolor: "#FFFFFF",
                    }}
                >
                    {/* Header */}
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            px: 2.5,
                            py: 2,
                            borderBottom: "1px solid #F1F5F9",
                            bgcolor: "#FFFFFF",
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Avatar
                                src={iscaProfile}
                                alt="ICSA Agent"
                                sx={{
                                    width: 40,
                                    height: 40,
                                    border: "1.5px solid #D97706",
                                    boxShadow: "0 2px 8px rgba(128, 0, 0, 0.2)",
                                }}
                            />
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#1A1A1A", lineHeight: 1.2 }}>
                                    Citizen Service Assistant
                                </Typography>
                                <Typography variant="caption" sx={{ color: "#64748B", display: "block" }}>
                                    Instant guidance grounded on PUP's Official Citizen's Charter
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Button
                                size="small"
                                onClick={() => { setMessages([]); setInput(""); }}
                                sx={{
                                    bgcolor: "#FFFBEB",
                                    color: "#800000",
                                    border: "1px solid #FDE68A",
                                    borderRadius: 999,
                                    px: 1.5,
                                    py: 0.4,
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    "&:hover": { bgcolor: "#800000", color: "#FFFFFF", borderColor: "#800000" },
                                }}
                            >
                                New Chat
                            </Button>
                            <IconButton size="small" onClick={() => setIsOpen(false)}>
                                <CloseIcon fontSize="small" sx={{ color: "#94A3B8" }} />
                            </IconButton>
                        </Box>
                    </Box>

                    {/* Messages Body */}
                    <Box
                        sx={{
                            flex: 1,
                            overflowY: "auto",
                            p: 2.5,
                            bgcolor: "#FAFBFD",
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                        }}
                    >
                        {messages.length === 0 ? (
                            /* Welcome / Empty Hero State */
                            <Box sx={{ textAlign: "center", my: "auto", py: 2 }}>
                                <Chip
                                    label="PUP CALOOCAN CITIZEN'S CHARTER"
                                    size="small"
                                    sx={{
                                        bgcolor: "#FEF3C7",
                                        border: "1px solid #FDE68A",
                                        color: "#92400E",
                                        fontWeight: 800,
                                        fontSize: "0.68rem",
                                        mb: 1.5,
                                    }}
                                />
                                <Typography variant="h5" sx={{ fontWeight: 800, color: "#800000", mb: 1, fontSize: "1.45rem" }}>
                                    Welcome to Citizen Service Assistant
                                </Typography>
                                <Typography variant="body2" sx={{ color: "#64748B", mb: 3, maxWidth: 420, mx: "auto", fontSize: "0.82rem" }}>
                                    How may we assist you today? Select a frequent inquiry below or type your specific service question.
                                </Typography>

                                <Box
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                                        gap: 1.5,
                                        maxWidth: 460,
                                        mx: "auto",
                                    }}
                                >
                                    {SUGGESTED_QUESTIONS.map((item) => (
                                        <Paper
                                            key={item.question}
                                            variant="outlined"
                                            onClick={() => handleSend(item.question)}
                                            sx={{
                                                p: 1.8,
                                                textAlign: "left",
                                                cursor: "pointer",
                                                borderRadius: 3,
                                                borderColor: "#E2E8F0",
                                                transition: "all 0.2s ease",
                                                display: "flex",
                                                flexDirection: "column",
                                                justifyContent: "space-between",
                                                "&:hover": {
                                                    transform: "translateY(-2px)",
                                                    borderColor: "#800000",
                                                    boxShadow: "0 6px 16px rgba(128, 0, 0, 0.12)",
                                                    bgcolor: "#FFFDF9",
                                                },
                                            }}
                                        >
                                            <Chip
                                                label={item.category}
                                                size="small"
                                                sx={{
                                                    bgcolor: "rgba(128, 0, 0, 0.06)",
                                                    color: "#800000",
                                                    fontWeight: 800,
                                                    fontSize: "0.62rem",
                                                    width: "fit-content",
                                                    mb: 1,
                                                    height: 20,
                                                }}
                                            />
                                            <Typography variant="body2" sx={{ fontWeight: 600, color: "#1E293B", mb: 1, fontSize: "0.82rem" }}>
                                                "{item.question}"
                                            </Typography>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "#800000", fontSize: "0.72rem", fontWeight: 700 }}>
                                                Inquire service <ArrowForwardIcon sx={{ fontSize: 13 }} />
                                            </Box>
                                        </Paper>
                                    ))}
                                </Box>
                            </Box>
                        ) : (
                            /* Active Messages */
                            messages.map((m) => (
                                <Box
                                    key={m.id}
                                    sx={{
                                        display: "flex",
                                        alignItems: "flex-end",
                                        justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                                        gap: 1.2,
                                    }}
                                >
                                    {m.role === "assistant" && (
                                        <Avatar
                                            src={iscaProfile}
                                            alt="ICSA Assistant"
                                            sx={{
                                                width: 28,
                                                height: 28,
                                                border: "1px solid #D97706",
                                                boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                                            }}
                                        />
                                    )}

                                    <Paper
                                        elevation={0}
                                        sx={{
                                            p: 1.8,
                                            maxWidth: "80%",
                                            borderRadius: 3,
                                            ...(m.role === "user"
                                                ? {
                                                    bgcolor: "#800000",
                                                    color: "#FFFFFF",
                                                    borderBottomRightRadius: 1,
                                                    boxShadow: "0 4px 14px rgba(128, 0, 0, 0.25)",
                                                }
                                                : m.isError
                                                    ? {
                                                        bgcolor: "#FEF2F2",
                                                        color: "#991B1B",
                                                        border: "1px solid #FCA5A5",
                                                        borderLeft: "3.5px solid #DC2626",
                                                        borderBottomLeftRadius: 1,
                                                    }
                                                    : {
                                                        bgcolor: "#FFFFFF",
                                                        color: "#1E293B",
                                                        border: "1px solid #E2E8F0",
                                                        borderLeft: "3.5px solid #D97706",
                                                        borderBottomLeftRadius: 1,
                                                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                                                    }),
                                        }}
                                    >
                                        <FormattedText content={m.content} />
                                        {m.matched_service && (
                                            <Box
                                                sx={{
                                                    mt: 1.2,
                                                    p: 1,
                                                    bgcolor: "#FFFBEB",
                                                    border: "1px solid #FDE68A",
                                                    borderLeft: "3px solid #D97706",
                                                    borderRadius: 1.5,
                                                    fontSize: "0.72rem",
                                                    color: "#92400E",
                                                    fontWeight: 700,
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                }}
                                            >
                                                <span>{m.matched_service}</span>
                                                {m.office && (
                                                    <Chip
                                                        label={m.office}
                                                        size="small"
                                                        sx={{ bgcolor: "#FEF3C7", fontSize: "0.62rem", height: 18, fontWeight: 800 }}
                                                    />
                                                )}
                                            </Box>
                                        )}
                                    </Paper>
                                </Box>
                            ))
                        )}

                        {/* Loading Indicator */}
                        {isLoading && (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}>
                                <Avatar
                                    src={iscaProfile}
                                    alt="ICSA Assistant"
                                    sx={{ width: 28, height: 28, border: "1px solid #D97706" }}
                                />
                                <Typography variant="caption" sx={{ color: "#94A3B8", fontStyle: "italic", display: "flex", alignItems: "center", gap: 1 }}>
                                    <Box component="span" sx={{ display: "inline-flex", gap: 0.5 }}>
                                        <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#D97706" }} />
                                        <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#D97706" }} />
                                        <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#D97706" }} />
                                    </Box>
                                    Searching Citizen's Charter database...
                                </Typography>
                            </Box>
                        )}
                        <div ref={bottomRef} />
                    </Box>

                    {/* Bottom Input Area */}
                    <Box
                        sx={{
                            p: 2,
                            display: "flex",
                            alignItems: "center",
                            gap: 1.2,
                            borderTop: "1px solid #F1F5F9",
                            bgcolor: "#FFFFFF",
                        }}
                    >
                        <Paper
                            variant="outlined"
                            sx={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                px: 2,
                                py: 0.5,
                                borderRadius: 3,
                                borderColor: "#CBD5E1",
                                bgcolor: "#F8FAFC",
                                "&:focus-within": {
                                    borderColor: "#800000",
                                    bgcolor: "#FFFFFF",
                                    boxShadow: "0 0 0 3px rgba(128, 0, 0, 0.08)",
                                },
                            }}
                        >
                            <InputBase
                                inputRef={inputRef}
                                placeholder="Ask about any service, requirements, or process..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                disabled={isLoading}
                                sx={{ flex: 1, fontSize: "0.85rem" }}
                            />
                            <Chip
                                label="Press Enter"
                                size="small"
                                sx={{
                                    bgcolor: "#E2E8F0",
                                    color: "#94A3B8",
                                    fontWeight: 700,
                                    fontSize: "0.62rem",
                                    height: 18,
                                }}
                            />
                        </Paper>

                        <Button
                            variant="contained"
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isLoading}
                            endIcon={<SendIcon sx={{ fontSize: 16 }} />}
                            sx={{
                                bgcolor: "#800000",
                                borderRadius: 3,
                                px: 2.2,
                                py: 1.1,
                                fontSize: "0.84rem",
                                fontWeight: 700,
                                textTransform: "none",
                                boxShadow: "0 4px 12px rgba(128, 0, 0, 0.25)",
                                "&:hover": {
                                    bgcolor: "#660000",
                                },
                                "&:disabled": {
                                    bgcolor: "#CBD5E1",
                                    color: "#94A3B8",
                                },
                            }}
                        >
                            Send
                        </Button>
                    </Box>
                </Paper>
            </Zoom>
        </Box>
    );
}
